export interface InvoiceEmailData {
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
