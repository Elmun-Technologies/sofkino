// Single place for payment instructions shown to users. Adding Click/Payme
// later means adding another key here (e.g. `click`), not touching the
// controllers that read it.
function getPaymentInfo() {
    return {
        card: {
            number: process.env.PAYMENT_CARD || null,
            holderName: process.env.PAYMENT_CARD_NAME || null
        }
    };
}

module.exports = { getPaymentInfo };
