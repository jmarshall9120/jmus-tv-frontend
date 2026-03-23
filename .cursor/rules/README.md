# Cursor Rules

This directory contains Cursor rules that help the AI assistant follow your project's patterns and conventions for the Stryker Media dashboard.

## How It Works

- **`.cursorrules`** (root file) - Always applies to every conversation
- **`.cursor/rules/*.mdc`** - File-specific rules that apply when working with matching files

## Available Rules

### Core Rules
- **`.cursorrules`** - Project overview, general principles, Nuxt.js patterns

### File-Specific Rules
- **`api-patterns.mdc`** - AppSync GraphQL API patterns and data provider conventions
- **`aws-auth-patterns.mdc`** - AWS Cognito authentication patterns
- **`data-provider-patterns.mdc`** - Data provider abstraction patterns
- **`pinia-store-patterns.mdc`** - Pinia store patterns for state management
- **`component-patterns.mdc`** - Vue component patterns with Composition API
- **`vuetify-patterns.mdc`** - Vuetify UI component patterns

## Adding Your Own Patterns

When you create APIs or establish patterns:

1. **Document them here** - Add examples to the appropriate `.mdc` file
2. **Be specific** - Show both good and bad examples with code snippets
3. **Keep it concise** - Rules should be under 500 lines per file
4. **Update as needed** - As patterns evolve, update these rules

## Example: Documenting a New API Pattern

If you create a new API pattern, add it to `api-patterns.mdc`:

```markdown
### Your New Pattern

```typescript
// ✅ GOOD - Your pattern
export const useYourPattern = (): IDataProvider<YourType> => {
  return useAmplifyAppsyncProvider('YourQueryName')
}
```

**Important**: Always use this pattern for [specific use case]
```

## File-Specific Rules

Rules in `.cursor/rules/` apply automatically when you're working with files matching the `globs` pattern. For example:
- `api-patterns.mdc` applies when editing files in `composables/dataProviders/`, `composables/dataStores/`, or `stores/`
- `aws-auth-patterns.mdc` applies when editing auth-related files
- `component-patterns.mdc` applies when editing `.vue` files
- `vuetify-patterns.mdc` applies when editing Vue components

## Key Patterns to Follow

1. **OAuth SSO Auth** - Use OAuth code flow with SSO (bloggenai pattern)
2. **Direct GraphQL Fetch** - Use direct fetch with Authorization headers (bloggenai pattern)
3. **Model Layer** - Use parse/stringify for AWSJSON fields (bloggenai pattern)
4. **Error Handling** - Use `useErrorNotify` composable for centralized error reporting
5. **Store Pattern** - Use composables directly in stores (bloggenai) OR `useStoreBase` (IvonneWelchDashboard)
6. **Component Pattern** - Use Composition API with `<script setup>` and Vuetify components
7. **Legacy Patterns** - Data provider pattern and Amplify Auth still valid for reference (IvonneWelchDashboard)

## Tips

- The AI will read these rules automatically when relevant files are open
- You can reference existing code examples from other repos in your rules
- Keep rules focused - one concern per file
- Update rules as your patterns evolve
- Check existing implementations before creating new ones
