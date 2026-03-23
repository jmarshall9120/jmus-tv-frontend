# Postlog Pipeline Deployment Strategy

## ✅ Implementation Status

**Phase 1 (NEW Pipeline) - DEPLOYED (Glue Spark)**
- ✅ `src/glue/utils/parse_postlogs_pipeline.py` - 9-step pipeline
- ✅ `src/glue/parse_postlogs/parse_postlogs.py` - Glue job entry point
- ✅ `deploy.json` - Glue configuration (updated)
- ✅ `requirements.txt` - Dependencies (verified)
- ✅ `test_parse_postlogs_pipeline_local.py` - 7 tests, all passing
- ✅ Phase 1 integration test passing (dev)

**Phase 2 (Existing) - UPDATED & DEPLOYED (Glue Spark)**
- ✅ `src/glue/parse_postlogs_2/parse_postlogs_2.py` - Reads FileMetadata.context
- ✅ End-to-end test updated and passing (dev)

**Ready to Run**:
- Phase 1: `./jmus glue parse_postlogs --env dev --deploy`
- Phase 2: `./jmus glue parse_postlogs_2 --env dev --deploy`

---

## Overview

The new pipeline-based postlog parser runs as **two separate Glue Spark jobs** to match the existing two-phase architecture:

1. **Phase 1: PARSE_POSTLOGS** - Column discovery (CYCLE 1 + CYCLE 2)  
2. **Phase 2: PARSE_POSTLOGS_2** - Apply match table and write to catalog

This matches the existing `test_parse_postlogs.py` two-phase test flow.

---

## Current Structure

### Existing (Legacy) Jobs
- `src/glue/parse_postlogs/parse_postlogs.py` - Phase 1 (OLD monolithic notebook code)
- `src/glue/parse_postlogs_2/parse_postlogs_2.py` - Phase 2 (applies match table)
- `src/glue/parse_postlogs_lib/matrix_field_matcher.py` - Shared library

### New Pipeline Code
- `src/glue/parse_postlogs/parse_postlogs.py` - **NEW: Pipeline with 9 steps**
- `src/glue/utils/pipeline.py` - Pipeline framework
- `src/glue/utils/postlog_helpers.py` - Time/date detection helpers
- `src/glue/utils/field_analyzer.py` - CYCLE 1 analyzers
- `src/glue/utils/field_classifier.py` - CYCLE 2 classifiers
- `src/glue/utils/matrix_field_matcher.py` - Feature-based column matching

---

## Deployment Architecture

### Phase 1: PARSE_POSTLOGS (Column Discovery)

**Purpose**: Detect time/date columns, extract spots, classify semantic fields, store results in FileMetadata.context

**Pipeline Steps to Run**:
1. `load_files` - Read from S3
2. `detect_time_date` - CYCLE 1: Find time column
3. `normalize_data` - Extract spots with air_time/day_offset
4. `classify_fields` - CYCLE 2: Identify station/campaign/length/etc
5. `combine_files` - Merge all files
6. Store field_map in FileMetadata.context

**Glue Job Configuration (Spark)**:
```json
{
  "stack_name": "stryker-tv-stack-{env}",
  "workers": 2,
  "workerType": "G.1X",
    "timeout": 2400,
  "glueVersion": "5.0",
  "role_arn": "stryker-tv-stack-{env}.GlueServiceRoleArn",
  "scripts_bucket": "stryker-tv-stack-{env}.GlueScriptsBucketName",
  "libraries": [
    "src/catalog",
        "src/glue",
    "modules/jmus_catalog",
    "modules/jmus_aws_core"
  ],
  "env_vars": {
    "FILEMETADATA_TABLE": "filemetadatas-{env}.TableName",
    "ANALYTICSJOBS_TABLE": "analyticsjobs-{env}.TableName",
    "APPSYNC_ENDPOINT": "stryker-tv-stack-{env}.GraphQLApiUrl",
    "RAW_BUCKET": "stryker-tv-stack-{env}.RawDataBucketName",
    "PROCESSED_BUCKET": "stryker-tv-stack-{env}.ProcessedDataBucketName"
  }
}
```

**Entry Point Script** (`src/glue/parse_postlogs/parse_postlogs.py`):
```python
"""
Parse Postlogs Glue Job - Phase 1: Column Discovery

Detects time/date columns, extracts spots, classifies fields.
Stores detected column mapping in FileMetadata.context for Phase 2.
"""
import sys
import os
from awsglue.utils import getResolvedOptions
from awsglue.context import GlueContext
from awsglue.job import Job
from pyspark.context import SparkContext

# Add paths
workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
sys.path.insert(0, os.path.join(workspace_root, 'src'))
sys.path.insert(0, os.path.join(workspace_root, 'modules'))

# Import pipeline
from glue.utils.parse_postlogs_pipeline import pipeline
from catalog.schema.file_metadata import FileMetadataSchema
from catalog.schema.analytics_job import AnalyticsJobSchema
import boto3
import json

# Get job arguments
args = getResolvedOptions(sys.argv, ['JOB_NAME', 'JOB_SK', 'FILE_SK', 'ENV'])

job_name = args['JOB_NAME']
job_sk = args['JOB_SK']
file_sk = args['FILE_SK']
env = args['ENV']

# Environment variables (injected by deployment)
FILEMETADATA_TABLE = os.environ.get('FILEMETADATA_TABLE')
ANALYTICSJOBS_TABLE = os.environ.get('ANALYTICSJOBS_TABLE')
RAW_BUCKET = os.environ.get('RAW_BUCKET')
PROCESSED_BUCKET = os.environ.get('PROCESSED_BUCKET')

def main():
    print(f"=== PARSE_POSTLOGS Phase 1 ===")
    print(f"Job Name: {job_name}")
    print(f"Job SK: {job_sk}")
    print(f"File SK: {file_sk}")
    print(f"Environment: {env}")

    # Initialize Glue context for Spark jobs
    sc = SparkContext.getOrCreate()
    glue_context = GlueContext(sc)
    job = Job(glue_context)
    job.init(job_name, args)
    
    # Update job status to RUNNING
    dynamodb = boto3.resource('dynamodb', region_name='us-west-2')
    jobs_table = dynamodb.Table(ANALYTICSJOBS_TABLE)
    jobs_table.update_item(
        Key={'PK': 'STRYKER', 'SK': job_sk},
        UpdateExpression='SET #status = :status, started_at = :started',
        ExpressionAttributeNames={'#status': 'status'},
        ExpressionAttributeValues={
            ':status': 'RUNNING',
            ':started': datetime.now().isoformat()
        }
    )
    
    try:
        # Get FileMetadata to find S3 path
        files_table = dynamodb.Table(FILEMETADATA_TABLE)
        file_response = files_table.get_item(Key={'PK': 'STRYKER', 'SK': file_sk})
        file_metadata = file_response['Item']
        s3_path = file_metadata['s3_raw_path']
        
        # Download from S3 to local temp folder
        s3 = boto3.client('s3')
        bucket, key = s3_path.replace('s3://', '').split('/', 1)
        local_folder = '/tmp/postlogs'
        os.makedirs(local_folder, exist_ok=True)
        local_file = os.path.join(local_folder, os.path.basename(key))
        
        print(f"Downloading: {s3_path}")
        s3.download_file(bucket, key, local_file)
        
        # Run pipeline through classify_fields
        result = pipeline.run(
            folder_path=local_folder,
            to_step='classify_fields',
            env=env,
            log_level='INFO'
        )
        
        # Extract field maps from checkpoint
        classify_result = pipeline.checkpoints['classify_fields']
        field_maps = classify_result['file_field_maps']
        
        # Store in FileMetadata.context
        context = {
            'phase': 'DISCOVERY_COMPLETE',
            'pipeline_version': 'v1.0',
            'detected_columns': field_maps,
            'intermediate_s3_path': intermediate_s3_path,
            'spot_counts': pipeline.checkpoints['normalize_data']['spot_counts'],
            'total_spots': sum(pipeline.checkpoints['normalize_data']['spot_counts'].values()),
            'parse_postlogs': {
                'phase1_job_sk': job_sk,
                'intermediate_s3_path': intermediate_s3_path,
                'discovered_columns': list(field_maps.keys())
            }
        }
        
        files_table.update_item(
            Key={'PK': 'STRYKER', 'SK': file_sk},
            UpdateExpression='SET context = :context',
            ExpressionAttributeValues={':context': json.dumps(context)}
        )
        
        # Update job status to SUCCESS
        jobs_table.update_item(
            Key={'PK': 'STRYKER', 'SK': job_sk},
            UpdateExpression='SET #status = :status, completed_at = :completed, result = :result',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':status': 'SUCCESS',
                ':completed': datetime.now().isoformat(),
                ':result': json.dumps({
                    'total_spots': context['total_spots'],
                    'files_parsed': len(field_maps)
                })
            }
        )
        
        print(f"✅ Phase 1 complete: {context['total_spots']} spots from {len(field_maps)} files")
        job.commit()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        
        # Update job status to FAILED
        jobs_table.update_item(
            Key={'PK': 'STRYKER', 'SK': job_sk},
            UpdateExpression='SET #status = :status, completed_at = :completed, error = :error',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':status': 'FAILED',
                ':completed': datetime.now().isoformat(),
                ':error': str(e)
            }
        )
        raise

if __name__ == '__main__':
    main()
```

---

### Phase 2: PARSE_POSTLOGS_2 (Apply Match Table)

**Purpose**: Read FileMetadata.context field_map, apply user-provided match table, standardize, write to catalog

**Existing Code** (keep as-is, already implements this):
- `src/glue/parse_postlogs_2/parse_postlogs_2.py`

**Modifications Needed**:
- Read `detected_columns` from FileMetadata.context (instead of manual mapping)
- User can modify the field_map in UI before running Phase 2
- Apply the mapping to raw data
- Continue with existing standardization/station mapping/catalog write logic

---

## Integration Test Strategy

### Test File Structure
```
tests/
├── test_parse_postlogs.py              # E2E test (already exists)
├── test_parse_postlogs_phase1.py       # New: Phase 1 integration test
├── test_parse_postlogs_phase2.py       # Existing Phase 2 test
└── test_parse_postlogs_pipeline_local.py  # Local unit test (no AWS)
```

### Test 1: Local Pipeline Test (No AWS)
**File**: `tests/test_parse_postlogs_pipeline_local.py`

Tests pipeline logic up to `standardize_fields` (no AWS calls):
- Load local test files
- Run through CYCLE 1 + CYCLE 2
- Verify spot extraction
- Verify field detection
- Check data quality

### Test 2: Phase 1 Integration Test (AWS Dev)
**File**: `tests/test_parse_postlogs_phase1.py`

Tests deployed Glue job Phase 1:
- Upload test file to S3
- Create FileMetadata record
- Start PARSE_POSTLOGS job via GraphQL
- Monitor job completion
- Verify FileMetadata.context has detected_columns
- Check AnalyticsJob status = SUCCESS

### Test 3: Phase 2 Integration Test (Existing)
**File**: `tests/test_parse_postlogs.py` (already exists)

Tests full two-phase flow:
- Phase 1: Column discovery
- User confirms/modifies field_map
- Phase 2: Apply match table, write to catalog
- Verify output in tv_postlogs_cleaned table

---

## Deployment Commands

### Deploy Phase 1 (Column Discovery)
```bash
# Deploy new pipeline-based Phase 1 job
./jmus glue parse_postlogs --env dev --deploy
```

### Deploy Phase 2 (Apply Match Table)
```bash
# Redeploy Phase 2 with updated context reading
./jmus glue parse_postlogs_2 --env dev --deploy
```

### Run Integration Tests
```bash
# Local pipeline test (no AWS)
pytest tests/test_parse_postlogs_pipeline_local.py -v

# Phase 1 integration test (AWS dev)
pytest tests/test_parse_postlogs_phase1.py -v

# Full E2E test (both phases)
pytest tests/test_parse_postlogs.py -v
```

---

## Frontend Trigger Flow (Phase 1 -> Phase 2)

### Phase 1: Column Discovery

1. **Upload file**
     - `presignUpload` with `uploadType: POSTLOGS`
     - PUT file to S3 using presigned URL

2. **Create FileMetadata**
     - `createFileMetadata` with `type: POSTLOG`, `s3_raw_path`, `file_hash`, `file_name`

3. **Start Phase 1 job**
     - `startAnalyticsJob` with:
         ```graphql
         mutation {
             startAnalyticsJob(input: {
                 jobType: PARSE_POSTLOGS
                 file_sk: "POSTLOG#<uuid>"
             }) {
                 SK
                 status
                 job_id
             }
         }
         ```

4. **Monitor completion**
     - Poll `getAnalyticsJob(SK: ...)` or subscribe `onAnalyticsJobUpdate`
     - Expect `status: SUCCESS`

5. **Read detected columns**
     - `getFileMetadata(SK: ...)` → `context`
     - Phase 1 context fields:
         ```json
         {
             "phase": "DISCOVERY_COMPLETE",
             "detected_columns": { "<file>": {"station": {...}, ... } },
             "intermediate_s3_path": "s3://.../intermediate/postlogs/POSTLOG#.../",
             "spot_counts": { "<file>": 65 },
             "total_spots": 65,
             "parse_postlogs": {
                 "phase1_job_sk": "PARSE_POSTLOGS#...",
                 "intermediate_s3_path": "s3://...",
                 "discovered_columns": ["<file>"]
             }
         }
         ```

### Phase 2: Apply Match Table

1. **User confirms mapping**
     - Build `user.match_table` from detected columns
     - Example shape stored into FileMetadata.context:
         ```json
         {
             "user": {
                 "match_table": [
                     {"discovered_column": "Channel", "standard_field": "station"},
                     {"discovered_column": "Length", "standard_field": "length"}
                 ],
                 "media_year": 2025
             }
         }
         ```

2. **Update FileMetadata**
     - `updateFileMetadata(SK: ..., input: { context: <json> })`

3. **Start Phase 2 job**
     - `startAnalyticsJob` with:
         ```graphql
         mutation {
             startAnalyticsJob(input: {
                 jobType: PARSE_POSTLOGS_2
                 file_sk: "POSTLOG#<uuid>"
             }) {
                 SK
                 status
                 job_id
             }
         }
         ```

4. **Monitor completion**
     - Expect `AnalyticsJob.status = SUCCESS`
     - Expect `FileMetadata.status = CLEANED`
     - `s3_parsed_path` and `row_count` populated

---

## Deployment Checklist (Completed)

- [x] Create Phase 1 entry point for Spark
- [x] Update `deploy.json` with pipeline dependencies
- [x] Add FileMetadata.context write logic
- [x] Create `test_parse_postlogs_pipeline_local.py`
- [x] Create `test_parse_postlogs_phase1.py`
- [x] Update Phase 2 to read from context
- [x] Deploy to dev environment
- [x] Run integration tests
- [ ] Compare output with legacy Phase 1
- [ ] Cutover production traffic

---

## Benefits of Pipeline Approach

1. **Testability**: Each step can be tested independently
2. **Debuggability**: Checkpoints allow inspecting intermediate state
3. **Maintainability**: Clear separation of concerns vs 2825-line notebook
4. **Resumability**: Can resume from any checkpoint after failure
5. **Observability**: Structured logging shows progress through pipeline
6. **Extensibility**: Easy to add new steps or modify existing ones

---

## Next Steps

1. **Compare outputs** with legacy implementation
2. **Gradual cutover** - run both versions in parallel initially
