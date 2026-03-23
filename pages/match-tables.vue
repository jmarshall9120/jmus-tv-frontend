<template>
  <v-container fluid class="pa-4">
    <v-row>
      <v-col cols="12">
        <v-card variant="outlined" class="stryker-chart-card">
          <v-card-title class="d-flex align-center flex-wrap gap-2 stryker-chart-title">
            <v-icon start size="small" class="stryker-accent-icon">mdi-table-link</v-icon>
            <span>Match Tables</span>
            <v-spacer />
            <v-btn-toggle
              v-model="activeTable"
              mandatory
              density="compact"
              variant="outlined"
            >
              <v-btn value="station">Station Names</v-btn>
              <v-btn value="tfn">TFN Mappings</v-btn>
            </v-btn-toggle>
            <v-btn
              color="primary"
              prepend-icon="mdi-plus"
              class="ml-2"
              @click="openCreateDialog"
            >
              Add Mapping
            </v-btn>
          </v-card-title>
          <v-card-text>
            <p class="text-caption text-medium-emphasis mb-3">
              Maintain mapping tables for data normalization. Station names map raw station identifiers to standardized names. TFN mappings link phone numbers to stations.
            </p>
            <v-data-table
              :headers="currentHeaders"
              :items="currentItems"
              :loading="loading"
              item-value="id"
              density="comfortable"
              class="dashboard-table"
            >
              <template #[`item.aliases`]="{ item }">
                <span>{{ (item.aliases ?? []).join(', ') || '—' }}</span>
              </template>
              <template #[`item.actions`]="{ item }">
                <v-btn
                  icon="mdi-pencil"
                  size="small"
                  variant="text"
                  @click="openEditDialog(item)"
                />
                <v-btn
                  icon="mdi-delete"
                  size="small"
                  variant="text"
                  color="error"
                  @click="openDeleteDialog(item)"
                />
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Create/Edit Dialog -->
    <v-dialog v-model="dialogOpen" max-width="600">
      <v-card>
        <v-card-title>
          {{ editingItem ? `Edit ${activeTable === 'station' ? 'Station' : 'TFN'} Mapping` : `New ${activeTable === 'station' ? 'Station' : 'TFN'} Mapping` }}
        </v-card-title>
        <v-card-text>
          <template v-if="activeTable === 'station'">
            <v-text-field
              v-model="formData.normalized"
              label="Normalized (canonical) name"
              hint="Standardized station name"
              persistent-hint
              required
              class="mb-3"
            />
            <div class="mb-2">
              <label class="v-label mb-1 d-block text-medium-emphasis">Aliases</label>
              <p class="text-caption text-medium-emphasis mb-2">
                Type an alias and press comma or space to add it as a chip. Click × on a chip to remove.
              </p>
              <div class="station-aliases-wrap d-flex flex-wrap align-center gap-2 pa-2 rounded border">
                <v-chip
                  v-for="(alias, idx) in (formData.aliases ?? [])"
                  :key="idx"
                  size="small"
                  closable
                  @click:close="removeStationAlias(idx)"
                >
                  {{ alias }}
                </v-chip>
                <input
                  ref="stationAliasInputRef"
                  v-model="stationAliasInput"
                  type="text"
                  class="station-alias-input flex-grow-1"
                  placeholder="Type alias, then comma or space"
                  @keydown="onStationAliasKeydown"
                  @blur="flushStationAliasInput"
                >
              </div>
            </div>
          </template>
          <template v-else>
            <v-text-field
              v-model="formData.tfn"
              label="TFN (Phone Number)"
              hint="Phone number (e.g., 8553999090)"
              persistent-hint
              required
              class="mb-3"
            />
            <p class="text-caption text-medium-emphasis mb-2">
              Assignment history (current at top). The first row’s station is stored as the TFN’s primary alias.
            </p>
            <div class="tfn-assignments-table-wrap border rounded pa-2 mb-2">
              <table class="tfn-assignments-table w-100">
                <thead>
                  <tr>
                    <th class="text-left text-caption">Station</th>
                    <th class="text-left text-caption">Start date</th>
                    <th class="text-left text-caption">End date</th>
                    <th class="text-left text-caption">Is station</th>
                    <th class="text-left" style="width: 48px" />
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, idx) in tfnAssignments" :key="idx">
                    <td>
                      <v-text-field
                        v-model="row.station"
                        density="compact"
                        hide-details
                        variant="outlined"
                        placeholder="Station name"
                      />
                    </td>
                    <td>
                      <v-text-field
                        v-model="row.start_date"
                        density="compact"
                        hide-details
                        variant="outlined"
                        placeholder="e.g. 1/1/2024"
                      />
                    </td>
                    <td>
                      <v-text-field
                        v-model="row.end_date"
                        density="compact"
                        hide-details
                        variant="outlined"
                        placeholder="e.g. 12/31/2025"
                      />
                    </td>
                    <td class="pt-1">
                      <v-checkbox
                        v-model="row.is_station"
                        density="compact"
                        hide-details
                        color="primary"
                      />
                    </td>
                    <td class="pt-1">
                      <v-btn
                        icon="mdi-close"
                        size="x-small"
                        variant="text"
                        color="error"
                        :disabled="tfnAssignments.length <= 1"
                        @click="removeTfnAssignment(idx)"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
              <v-btn
                block
                variant="tonal"
                size="small"
                class="mt-2"
                prepend-icon="mdi-plus"
                @click="addTfnAssignment"
              >
                Add assignment
              </v-btn>
            </div>
          </template>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialogOpen = false">Cancel</v-btn>
          <v-btn color="primary" :loading="saving" @click="saveItem">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation -->
    <v-dialog v-model="deleteDialogOpen" max-width="400">
      <v-card>
        <v-card-title>Delete Mapping</v-card-title>
        <v-card-text>
          Are you sure you want to delete this mapping? This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialogOpen = false">Cancel</v-btn>
          <v-btn color="error" :loading="deleting" @click="confirmDelete">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
// Auth is handled by auth.global.ts middleware
import type { StationMapping, TfnMapping, TfnAssignment } from '@/composables/useMatchTables'

const { report: notifyError } = useErrorNotify()
const notifications = useNotificationsStore()
const {
  listStationMappings,
  listTfnMappings,
  createStationMapping,
  createTfnMapping,
  updateStationMapping,
  updateTfnMapping,
  deleteStationMapping,
  deleteTfnMapping,
} = useMatchTables()

const activeTable = ref<'station' | 'tfn'>('station')

const stationHeaders = [
  { title: 'Normalized (canonical)', key: 'normalized', sortable: true },
  { title: 'Aliases', key: 'aliases', sortable: false },
  { title: 'Actions', key: 'actions', sortable: false, width: '120px' }
]

const tfnHeaders = [
  { title: 'TFN', key: 'tfn', sortable: true },
  { title: 'Station (primary)', key: 'station', sortable: true },
  { title: 'All aliases', key: 'aliases', sortable: false },
  { title: 'Is Station TFN', key: 'isStation', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false, width: '120px' }
]

const stationMappings = ref<StationMapping[]>([])
const tfnMappings = ref<TfnMapping[]>([])
const loading = ref(false)
const dialogOpen = ref(false)
const deleteDialogOpen = ref(false)
const saving = ref(false)
const deleting = ref(false)
const editingItem = ref<StationMapping | TfnMapping | null>(null)
const deletingItem = ref<StationMapping | TfnMapping | null>(null)

const formData = ref<Partial<StationMapping & TfnMapping> & { aliases?: string[] }>({})
const stationAliasInput = ref('')
const stationAliasInputRef = ref<HTMLInputElement | null>(null)

/** TFN dialog: editable assignment rows (current at top) */
const tfnAssignments = ref<TfnAssignment[]>([])

const currentHeaders = computed(() => activeTable.value === 'station' ? stationHeaders : tfnHeaders)
const currentItems = computed(() => activeTable.value === 'station' ? stationMappings.value : tfnMappings.value)

async function loadStationMappings () {
  loading.value = true
  try {
    stationMappings.value = await listStationMappings()
  } catch (error) {
    notifyError(error, 'Load station mappings')
  } finally {
    loading.value = false
  }
}

async function loadTfnMappings () {
  loading.value = true
  try {
    tfnMappings.value = await listTfnMappings()
  } catch (error) {
    notifyError(error, 'Load TFN mappings')
  } finally {
    loading.value = false
  }
}

watch(activeTable, () => {
  if (activeTable.value === 'station') {
    loadStationMappings()
  } else {
    loadTfnMappings()
  }
})

function openCreateDialog () {
  editingItem.value = null
  if (activeTable.value === 'station') {
    formData.value = { normalized: '', aliases: [] }
    stationAliasInput.value = ''
  } else {
    formData.value = { tfn: '' }
    tfnAssignments.value = [newTfnAssignmentRow()]
  }
  dialogOpen.value = true
  nextTick(() => stationAliasInputRef.value?.focus())
}

function newTfnAssignmentRow (): TfnAssignment {
  return { station: '', start_date: '', end_date: '', is_station: false }
}

function addTfnAssignment () {
  tfnAssignments.value = [...tfnAssignments.value, newTfnAssignmentRow()]
}

function removeTfnAssignment (index: number) {
  if (tfnAssignments.value.length <= 1) return
  tfnAssignments.value = tfnAssignments.value.filter((_, i) => i !== index)
}

function openEditDialog (item: StationMapping | TfnMapping) {
  editingItem.value = item
  formData.value = {
    ...item,
    aliases: item.aliases ? [...item.aliases] : [],
  }
  stationAliasInput.value = ''
  if (item && 'assignments' in item && Array.isArray((item as TfnMapping).assignments) && (item as TfnMapping).assignments.length > 0) {
    tfnAssignments.value = (item as TfnMapping).assignments.map((a) => ({
      station: a.station ?? '',
      start_date: a.start_date ?? '',
      end_date: a.end_date ?? '',
      is_station: a.is_station ?? false,
      spot_length: a.spot_length,
      language: a.language,
      commercial_title: a.commercial_title,
    }))
  } else {
    tfnAssignments.value = [
      {
        station: (item as TfnMapping).station ?? '',
        start_date: '',
        end_date: '',
        is_station: (item as TfnMapping).isStation ?? false,
      },
    ]
  }
  dialogOpen.value = true
  nextTick(() => stationAliasInputRef.value?.focus())
}

function ensureStationAliasesArray () {
  if (!Array.isArray(formData.value.aliases)) {
    formData.value.aliases = []
  }
}

function flushStationAliasInput () {
  const raw = stationAliasInput.value?.trim()
  if (!raw) return
  ensureStationAliasesArray()
  if (!formData.value.aliases!.includes(raw)) {
    formData.value.aliases = [...formData.value.aliases!, raw]
  }
  stationAliasInput.value = ''
}

function onStationAliasKeydown (e: KeyboardEvent) {
  if (e.key === ',' || e.key === ' ') {
    e.preventDefault()
    flushStationAliasInput()
  }
}

function removeStationAlias (index: number) {
  ensureStationAliasesArray()
  formData.value.aliases = formData.value.aliases!.filter((_, i) => i !== index)
}

function openDeleteDialog (item: StationMapping | TfnMapping) {
  deletingItem.value = item
  deleteDialogOpen.value = true
}

async function saveItem () {
  saving.value = true
  try {
    if (activeTable.value === 'station') {
      flushStationAliasInput()
      const aliases = (formData.value.aliases ?? []).filter(Boolean)
      if (!formData.value.normalized?.trim()) {
        notifyError(new Error('Normalized name is required'), 'Save')
        return
      }
      if (aliases.length === 0) {
        notifyError(new Error('At least one alias is required'), 'Save')
        return
      }
      if (editingItem.value) {
        await updateStationMapping(editingItem.value.id, { aliases })
      } else {
        await createStationMapping({
          normalized: formData.value.normalized.trim(),
          aliases,
        })
      }
      await loadStationMappings()
    } else {
      const assignments = tfnAssignments.value
        .map((a) => ({
          station: a.station?.trim() ?? '',
          start_date: a.start_date?.trim() || undefined,
          end_date: a.end_date?.trim() || undefined,
          is_station: a.is_station ?? false,
          spot_length: a.spot_length?.trim() || undefined,
          language: a.language?.trim() || undefined,
          commercial_title: a.commercial_title?.trim() || undefined,
        }))
        .filter((a) => a.station !== '')
      if (assignments.length === 0) {
        notifyError(new Error('At least one assignment with a station name is required'), 'Save')
        return
      }
      if (editingItem.value) {
        await updateTfnMapping(editingItem.value.id, { assignments })
      } else {
        if (!formData.value.tfn?.trim()) {
          notifyError(new Error('TFN (phone number) is required'), 'Save')
          return
        }
        await createTfnMapping({ tfn: formData.value.tfn.trim(), assignments })
      }
      await loadTfnMappings()
    }
    dialogOpen.value = false
    notifications.success('Mapping saved')
  } catch (error) {
    notifyError(error, 'Save mapping')
  } finally {
    saving.value = false
  }
}

async function confirmDelete () {
  if (!deletingItem.value) return
  deleting.value = true
  try {
    if (activeTable.value === 'station') {
      await deleteStationMapping(deletingItem.value.id)
      await loadStationMappings()
    } else {
      await deleteTfnMapping(deletingItem.value.id)
      await loadTfnMappings()
    }
    deleteDialogOpen.value = false
    deletingItem.value = null
    notifications.success('Mapping deleted')
  } catch (error) {
    notifyError(error, 'Delete mapping')
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  loadStationMappings()
})
</script>

<style scoped>
.stryker-chart-card {
  background: rgba(255, 255, 255, 0.02);
}
.stryker-chart-title {
  color: rgb(var(--v-theme-on-surface));
}
.stryker-accent-icon {
  color: rgb(var(--v-theme-secondary));
}

.station-aliases-wrap {
  min-height: 42px;
  border-color: rgba(var(--v-border-color), var(--v-border-opacity));
}
.station-alias-input {
  min-width: 180px;
  padding: 4px 8px;
  font: inherit;
  color: inherit;
  background: transparent;
  border: none;
  outline: none;
}
.station-alias-input::placeholder {
  color: rgba(var(--v-theme-on-surface), 0.5);
}

.tfn-assignments-table-wrap {
  border-color: rgba(var(--v-border-color), var(--v-border-opacity));
}
.tfn-assignments-table th {
  padding: 4px 8px;
  font-weight: 600;
}
.tfn-assignments-table td {
  padding: 4px 8px;
  vertical-align: middle;
}
.tfn-assignments-table .v-text-field {
  max-width: 140px;
}
</style>
