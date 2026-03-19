import { Client } from '@notionhq/client'

const notion = new Client({ auth: process.env.NOTION_API_KEY })
const OPERATOR_DB_ID = process.env.NOTION_OPERATOR_DATABASE_ID ?? ''

export interface OperatorCRMEntry {
  hotelName: string
  ownerEmail: string
  ownerPhone?: string
  setupStatus: 'Pending' | 'Configured' | 'Live'
  subscriptionStatus: string
  mrr: number
  tenantId: string
}

export async function upsertOperatorCRMEntry(entry: OperatorCRMEntry): Promise<void> {
  if (!OPERATOR_DB_ID) return

  // Check if page already exists for this tenant
  const existing = await notion.databases.query({
    database_id: OPERATOR_DB_ID,
    filter: { property: 'TenantID', rich_text: { equals: entry.tenantId } },
  })

  const properties = {
    'Hotel Name': { title: [{ text: { content: entry.hotelName } }] },
    'Email': { email: entry.ownerEmail },
    'Phone': { phone_number: entry.ownerPhone ?? '' },
    'Setup Status': { select: { name: entry.setupStatus } },
    'Subscription': { select: { name: entry.subscriptionStatus } },
    'MRR': { number: entry.mrr },
    'TenantID': { rich_text: [{ text: { content: entry.tenantId } }] },
  }

  if (existing.results.length > 0) {
    await notion.pages.update({ page_id: existing.results[0].id, properties })
  } else {
    await notion.pages.create({ parent: { database_id: OPERATOR_DB_ID }, properties })
  }
}
