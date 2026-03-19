import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

export interface InvoicePDFProps {
  invoiceNumber: string
  hotelName: string
  hotelAddress: string
  hotelLogo?: string
  guestName: string
  guestEmail: string
  guestPhone: string
  roomName: string
  checkIn: string
  checkOut: string
  nights: number
  pricePerNight: number
  totalPrice: number
  currency: string
  stripePaymentLink: string
  iban?: string
  expiresAt: string
}

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 11 },
  header: { marginBottom: 20 },
  title: { fontSize: 20, marginBottom: 8 },
  section: { marginBottom: 12 },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { width: 140, color: '#666' },
  value: { flex: 1 },
  total: { fontSize: 14, fontWeight: 'bold', marginTop: 12 },
  deadline: { marginTop: 16, color: '#dc2626', fontWeight: 'bold' },
  payLink: { marginTop: 8, color: '#2563eb' },
})

export function InvoicePDF(data: InvoicePDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{data.hotelName}</Text>
          <Text>{data.hotelAddress}</Text>
        </View>

        <Text style={{ fontSize: 16, marginBottom: 16 }}>
          Фактура #{data.invoiceNumber}
        </Text>

        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Гост:</Text>
            <Text style={styles.value}>{data.guestName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Email:</Text>
            <Text style={styles.value}>{data.guestEmail}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Телефон:</Text>
            <Text style={styles.value}>{data.guestPhone}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>Стая:</Text>
            <Text style={styles.value}>{data.roomName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Настаняване:</Text>
            <Text style={styles.value}>{data.checkIn}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Напускане:</Text>
            <Text style={styles.value}>{data.checkOut}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Нощувки:</Text>
            <Text style={styles.value}>{data.nights}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Цена на нощ:</Text>
            <Text style={styles.value}>{data.pricePerNight} {data.currency}</Text>
          </View>
        </View>

        <Text style={styles.total}>
          Обща сума: {data.totalPrice} {data.currency}
        </Text>

        <Text style={styles.deadline}>
          Краен срок за плащане: {new Date(data.expiresAt).toLocaleString('bg-BG')}
        </Text>

        <Text style={styles.payLink}>Платете онлайн: {data.stripePaymentLink}</Text>

        {data.iban && (
          <Text style={{ marginTop: 8 }}>Банков превод: IBAN {data.iban}</Text>
        )}
      </Page>
    </Document>
  )
}
