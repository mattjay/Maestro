import SwiftUI

/// Checkout flow with shipping and payment forms.
struct CheckoutView: View {
    @EnvironmentObject var appState: AppState
    @State private var currentStep = 0
    @State private var shippingAddress = ShippingAddress()
    @State private var paymentInfo = PaymentInfo()
    @State private var order: Order?

    var body: some View {
        VStack(spacing: 0) {
            // Step indicator
            HStack {
                StepIndicator(step: 1, title: "Shipping", isActive: currentStep >= 0)
                StepIndicator(step: 2, title: "Payment", isActive: currentStep >= 1)
                StepIndicator(step: 3, title: "Review", isActive: currentStep >= 2)
            }
            .padding()

            Divider()

            // Current step content
            TabView(selection: $currentStep) {
                ShippingFormView(
                    shippingAddress: $shippingAddress,
                    onContinue: { currentStep = 1 }
                )
                .tag(0)

                PaymentFormView(
                    paymentInfo: $paymentInfo,
                    onContinue: { currentStep = 2 }
                )
                .tag(1)

                OrderReviewView(
                    shippingAddress: shippingAddress,
                    paymentInfo: paymentInfo,
                    onPlaceOrder: placeOrder
                )
                .tag(2)

                if let order = order {
                    OrderConfirmationView(order: order)
                        .tag(3)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
        }
        .navigationTitle(order != nil ? "Order Confirmed" : "Checkout")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func placeOrder() {
        let newOrder = Order(
            id: UUID().uuidString,
            items: appState.cart,
            shippingAddress: shippingAddress,
            total: appState.cart.reduce(0) { $0 + $1.totalPrice },
            createdAt: Date()
        )
        order = newOrder
        appState.clearCart()
        currentStep = 3
    }
}

/// Step indicator for checkout progress.
struct StepIndicator: View {
    let step: Int
    let title: String
    let isActive: Bool

    var body: some View {
        VStack(spacing: 4) {
            ZStack {
                Circle()
                    .fill(isActive ? Color.blue : Color(.systemGray4))
                    .frame(width: 30, height: 30)
                Text("\(step)")
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundColor(isActive ? .white : .secondary)
            }
            Text(title)
                .font(.caption2)
                .foregroundColor(isActive ? .primary : .secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

/// Shipping address form.
struct ShippingFormView: View {
    @Binding var shippingAddress: ShippingAddress
    let onContinue: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Shipping Information")
                    .font(.title2)
                    .fontWeight(.bold)
                    .accessibilityIdentifier("shippingTitle")

                VStack(spacing: 16) {
                    FormField(
                        title: "Full Name",
                        text: $shippingAddress.name,
                        placeholder: "John Doe",
                        identifier: "shippingName"
                    )

                    FormField(
                        title: "Address",
                        text: $shippingAddress.address,
                        placeholder: "123 Main Street",
                        identifier: "shippingAddress"
                    )

                    FormField(
                        title: "City",
                        text: $shippingAddress.city,
                        placeholder: "San Francisco",
                        identifier: "shippingCity"
                    )

                    FormField(
                        title: "ZIP Code",
                        text: $shippingAddress.zipCode,
                        placeholder: "94105",
                        identifier: "shippingZip"
                    )
                }

                Button(action: onContinue) {
                    Text("Continue to Payment")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(shippingAddress.isValid ? Color.blue : Color.gray)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                }
                .disabled(!shippingAddress.isValid)
                .accessibilityIdentifier("continueToPaymentButton")
            }
            .padding()
        }
    }
}

/// Payment information form.
struct PaymentFormView: View {
    @Binding var paymentInfo: PaymentInfo
    let onContinue: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Payment Information")
                    .font(.title2)
                    .fontWeight(.bold)
                    .accessibilityIdentifier("paymentTitle")

                VStack(spacing: 16) {
                    FormField(
                        title: "Card Number",
                        text: $paymentInfo.cardNumber,
                        placeholder: "4242 4242 4242 4242",
                        identifier: "cardNumber"
                    )

                    HStack(spacing: 16) {
                        FormField(
                            title: "Expiry",
                            text: $paymentInfo.expiry,
                            placeholder: "MM/YY",
                            identifier: "cardExpiry"
                        )

                        FormField(
                            title: "CVC",
                            text: $paymentInfo.cvc,
                            placeholder: "123",
                            identifier: "cardCvc"
                        )
                    }
                }

                Button(action: onContinue) {
                    Text("Review Order")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(paymentInfo.isValid ? Color.blue : Color.gray)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                }
                .disabled(!paymentInfo.isValid)
                .accessibilityIdentifier("reviewOrderButton")
            }
            .padding()
        }
    }
}

/// Order review before placing.
struct OrderReviewView: View {
    @EnvironmentObject var appState: AppState
    let shippingAddress: ShippingAddress
    let paymentInfo: PaymentInfo
    let onPlaceOrder: () -> Void

    var totalPrice: Decimal {
        appState.cart.reduce(0) { $0 + $1.totalPrice }
    }

    var formattedTotal: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        return formatter.string(from: totalPrice as NSDecimalNumber) ?? "$\(totalPrice)"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Order Summary")
                    .font(.title2)
                    .fontWeight(.bold)
                    .accessibilityIdentifier("orderSummaryTitle")

                // Items
                VStack(spacing: 12) {
                    ForEach(appState.cart) { item in
                        HStack {
                            Text(item.product.name)
                            Spacer()
                            Text("x\(item.quantity)")
                                .foregroundColor(.secondary)
                            Text(item.product.formattedPrice)
                                .fontWeight(.medium)
                        }
                    }
                    Divider()
                    HStack {
                        Text("Total")
                            .font(.headline)
                        Spacer()
                        Text(formattedTotal)
                            .font(.headline)
                            .foregroundColor(.blue)
                    }
                }
                .padding()
                .background(Color(.secondarySystemBackground))
                .cornerRadius(12)

                // Shipping summary
                VStack(alignment: .leading, spacing: 8) {
                    Text("Shipping to:")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    Text(shippingAddress.name)
                        .fontWeight(.medium)
                    Text(shippingAddress.address)
                    Text("\(shippingAddress.city), \(shippingAddress.zipCode)")
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.secondarySystemBackground))
                .cornerRadius(12)

                // Payment summary
                VStack(alignment: .leading, spacing: 8) {
                    Text("Payment method:")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    HStack {
                        Image(systemName: "creditcard.fill")
                        Text("**** **** **** \(String(paymentInfo.cardNumber.suffix(4)))")
                    }
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.secondarySystemBackground))
                .cornerRadius(12)

                Button(action: onPlaceOrder) {
                    Text("Place Order")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                }
                .accessibilityIdentifier("placeOrderButton")
            }
            .padding()
        }
    }
}

/// Order confirmation screen.
struct OrderConfirmationView: View {
    let order: Order

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 80))
                .foregroundColor(.green)

            Text("Order Confirmed")
                .font(.title)
                .fontWeight(.bold)
                .accessibilityIdentifier("orderConfirmedTitle")

            Text(order.formattedOrderNumber)
                .font(.headline)
                .foregroundColor(.secondary)
                .accessibilityIdentifier("orderNumber")

            Text("Thank you for your purchase!")
                .foregroundColor(.secondary)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// Reusable form field component.
struct FormField: View {
    let title: String
    @Binding var text: String
    let placeholder: String
    let identifier: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
            TextField(placeholder, text: $text)
                .textFieldStyle(.roundedBorder)
                .accessibilityIdentifier(identifier)
        }
    }
}

#Preview {
    NavigationView {
        CheckoutView()
            .environmentObject({
                let state = AppState()
                state.addToCart(Product.sampleProducts[0])
                return state
            }())
    }
}
