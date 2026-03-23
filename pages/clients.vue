<template>
  <v-container fluid class="pa-4">
    <v-row>
      <v-col cols="12">
        <v-card variant="outlined" class="stryker-chart-card">
          <v-card-title class="d-flex align-center flex-wrap gap-2 stryker-chart-title">
            <v-icon start size="small" class="stryker-accent-icon">mdi-domain</v-icon>
            <span>Client Management</span>
            <v-spacer />
            <v-btn
              color="primary"
              prepend-icon="mdi-plus"
              @click="openCreateDialog"
            >
              New Client
            </v-btn>
          </v-card-title>
          <v-card-text>
            <p class="text-caption text-medium-emphasis mb-3">
              Manage clients and their data configurations. Each client has its own dataset and dashboard configuration.
            </p>
            <v-data-table
              :headers="headers"
              :items="clients"
              :loading="loading"
              item-value="id"
              density="comfortable"
              class="dashboard-table"
            >
              <template #[`item.products`]="{ item }">
                <div class="d-flex flex-wrap gap-1 py-1">
                  <v-chip
                    v-for="p in item.products"
                    :key="p"
                    size="x-small"
                    variant="tonal"
                    color="secondary"
                  >{{ p }}</v-chip>
                </div>
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
          {{ editingClient ? 'Edit Client' : 'New Client' }}
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="formData.name"
            label="Client Name"
            required
            class="mb-2"
          />
          <v-text-field
            v-model="formData.code"
            label="Client Code"
            hint="Short identifier (e.g., ABC)"
            persistent-hint
            class="mb-2"
          />
          <v-textarea
            v-model="formData.description"
            label="Description"
            rows="3"
            class="mb-2"
          />
          <v-divider class="my-3" />
          <div class="text-subtitle-2 mb-2">Products</div>
          <v-list density="compact" class="pa-0 mb-2" v-if="(formData.products ?? []).length">
            <v-list-item
              v-for="(product, i) in formData.products"
              :key="i"
              class="px-0"
            >
              <template #title>
                <span class="text-body-2">{{ product }}</span>
              </template>
              <template #append>
                <v-btn
                  icon="mdi-close"
                  size="x-small"
                  variant="text"
                  color="error"
                  @click="removeProduct(i)"
                />
              </template>
            </v-list-item>
          </v-list>
          <p v-else class="text-caption text-disabled mb-2">No products yet.</p>
          <div class="d-flex gap-2 align-center">
            <v-text-field
              v-model="newProductName"
              label="Add product"
              density="compact"
              hide-details
              @keydown.enter.prevent="addProduct"
            />
            <v-btn
              icon="mdi-plus"
              size="small"
              color="primary"
              variant="tonal"
              :disabled="!newProductName.trim()"
              @click="addProduct"
            />
          </div>
          <v-divider class="my-3" />
          <v-switch
            v-model="formData.active"
            label="Active"
            color="primary"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialogOpen = false">Cancel</v-btn>
          <v-btn color="primary" @click="saveClient" :loading="saving">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation -->
    <v-dialog v-model="deleteDialogOpen" max-width="400">
      <v-card>
        <v-card-title>Delete Client</v-card-title>
        <v-card-text>
          Are you sure you want to delete <strong>{{ deletingClient?.name }}</strong>? This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="deleteDialogOpen = false">Cancel</v-btn>
          <v-btn color="error" @click="confirmDelete" :loading="deleting">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
// Auth is handled by auth.global.ts middleware

interface Client {
  id: string
  name: string
  code: string
  description?: string
  dataBucket?: string
  products: string[]
  active: boolean
  createdAt?: string
  updatedAt?: string
}

const headers = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Code', key: 'code', sortable: true },
  { title: 'Products', key: 'products', sortable: false },
  { title: 'Active', key: 'active', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false, width: '120px' }
]

const clients = ref<Client[]>([])
const loading = ref(false)
const dialogOpen = ref(false)
const deleteDialogOpen = ref(false)
const saving = ref(false)
const deleting = ref(false)
const editingClient = ref<Client | null>(null)
const deletingClient = ref<Client | null>(null)

const formData = ref<Partial<Client>>({
  name: '',
  code: '',
  description: '',
  dataBucket: '',
  products: [],
  active: true
})

const newProductName = ref('')

function addProduct () {
  const name = newProductName.value.trim()
  if (!name) return
  formData.value.products = [...(formData.value.products ?? []), name]
  newProductName.value = ''
}

function removeProduct (index: number) {
  formData.value.products = (formData.value.products ?? []).filter((_, i) => i !== index)
}

async function loadClients () {
  loading.value = true
  try {
    // TODO: Replace with actual API call
    // const data = await useStrykerData().listClients()
    // clients.value = data
    clients.value = [
      {
        id: 'client-001',
        name: 'Pacific Home Solutions',
        code: 'PHS',
        description: 'Regional home improvement retailer, Bay Area & Central Coast',
        dataBucket: 'jmus-data-phs-prod',
        products: ['Window Replacement', 'Gutter Guards', 'Bath Remodel'],
        active: true,
        createdAt: '2024-08-12',
        updatedAt: '2026-03-01'
      },
      {
        id: 'client-002',
        name: 'Coastline Legal Group',
        code: 'CLG',
        description: 'Personal injury and mass tort law firm',
        dataBucket: 'jmus-data-clg-prod',
        products: ['Auto Accident', 'Slip & Fall', 'Mesothelioma'],
        active: true,
        createdAt: '2024-11-03',
        updatedAt: '2026-02-18'
      },
      {
        id: 'client-003',
        name: 'SunPath Solar',
        code: 'SPS',
        description: 'Residential solar panel installation, CA & AZ markets',
        dataBucket: 'jmus-data-sps-prod',
        products: ['Rooftop Solar', 'Battery Storage'],
        active: true,
        createdAt: '2025-01-22',
        updatedAt: '2026-03-10'
      },
      {
        id: 'client-004',
        name: 'Meridian Insurance Services',
        code: 'MIS',
        description: 'Medicare supplement and final expense insurance',
        dataBucket: 'jmus-data-mis-prod',
        products: ['Medicare Supplement', 'Final Expense', 'Dental & Vision'],
        active: true,
        createdAt: '2025-03-07',
        updatedAt: '2026-03-14'
      },
      {
        id: 'client-005',
        name: 'Vertex Debt Relief',
        code: 'VDR',
        description: 'Debt settlement and credit counseling services',
        dataBucket: 'jmus-data-vdr-prod',
        products: ['Debt Settlement', 'Credit Counseling'],
        active: true,
        createdAt: '2025-05-19',
        updatedAt: '2026-01-30'
      },
      {
        id: 'client-006',
        name: 'NorthBay Roofing Co.',
        code: 'NBR',
        description: 'Roofing and exterior contractors, Northern California',
        dataBucket: 'jmus-data-nbr-prod',
        products: ['Roof Replacement', 'Siding', 'Skylights'],
        active: false,
        createdAt: '2024-06-01',
        updatedAt: '2025-11-05'
      }
    ]
  } catch (error) {
    console.error('Failed to load clients:', error)
  } finally {
    loading.value = false
  }
}

function openCreateDialog () {
  editingClient.value = null
  newProductName.value = ''
  formData.value = {
    name: '',
    code: '',
    description: '',
    dataBucket: '',
    products: [],
    active: true
  }
  dialogOpen.value = true
}

function openEditDialog (client: Client) {
  editingClient.value = client
  newProductName.value = ''
  formData.value = { ...client, products: [...client.products] }
  dialogOpen.value = true
}

function openDeleteDialog (client: Client) {
  deletingClient.value = client
  deleteDialogOpen.value = true
}

async function saveClient () {
  saving.value = true
  try {
    // TODO: Replace with actual API call
    // if (editingClient.value) {
    //   await useStrykerData().updateClient(editingClient.value.id, formData.value)
    // } else {
    //   await useStrykerData().createClient(formData.value)
    // }
    await loadClients()
    dialogOpen.value = false
  } catch (error) {
    console.error('Failed to save client:', error)
  } finally {
    saving.value = false
  }
}

async function confirmDelete () {
  if (!deletingClient.value) return
  deleting.value = true
  try {
    // TODO: Replace with actual API call
    // await useStrykerData().deleteClient(deletingClient.value.id)
    await loadClients()
    deleteDialogOpen.value = false
    deletingClient.value = null
  } catch (error) {
    console.error('Failed to delete client:', error)
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  loadClients()
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
</style>
