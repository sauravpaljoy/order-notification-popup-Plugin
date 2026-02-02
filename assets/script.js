jQuery(function ($) {

    // Track the last seen order timestamp and ID
    let lastSeenTimestamp = parseInt(localStorage.getItem('onp_last_seen_timestamp') || '0');
    let shownOrderIds = JSON.parse(localStorage.getItem('onp_shown_order_ids') || '[]');
    let lastDisplayedOrder = JSON.parse(localStorage.getItem('onp_last_displayed_order') || 'null');

    // On page load, if no timestamp exists, set to current time minus 1 minute
    // This allows showing orders from the last minute on first load
    if (lastSeenTimestamp === 0) {
        lastSeenTimestamp = Math.floor(Date.now() / 1000) - 60; // 1 minute ago
        localStorage.setItem('onp_last_seen_timestamp', lastSeenTimestamp.toString());
    }

    // Function to display the popup with order data
    function displayPopup(orderData, isNewOrder) {
        // Remove any existing popup before showing new one
        $('#onp-popup').remove();

        function maskOrderId(orderId) {
            const s = String(orderId ?? '');
            const first2 = s.slice(0, 2);
            return `${first2 || s}**`;
        }

        let html = `
            <div id="onp-popup">
                <div class="onp-card">
                    <div class="onp-inner">
                        <div class="onp-header">
                            <div class="onp-title">🎉 New Order Received 🎊 </div>
                            
                        </div>

                        <div class="onp-row">
                            <span class="onp-row-icon">🧾</span>
                            <span class="onp-row-label">Order ID:</span>
                            <span class="onp-row-value">#${maskOrderId(orderData.order_id)}</span>
                                <div class="onp-amount-pill">
                                <span class="onp-amount-icon">💰</span>
                                <span class="onp-amount-text">${orderData.amount}</span>
                            </div>
                        </div>

                        <div class="onp-row">
                            <span class="onp-row-icon">👤</span>
                            <span class="onp-row-label">Customer:</span>
                            <span class="onp-row-value">${orderData.name}</span>
                        </div>

                        <div class="onp-row">
                            <span class="onp-row-icon">🛒</span>
                            <span class="onp-row-label">Product:</span>
                            <span class="onp-row-value onp-row-value-product">${orderData.product}</span>
                        </div>
                    </div>
                </div>
            </div>`;

        $('body').append(html);
        $('#onp-popup').fadeIn();

        setTimeout(() => {
            $('#onp-popup').fadeOut(function () {
                $(this).remove();
            });
        }, 7000);
    }

    function checkForOrders() {
        $.post(onpData.ajaxurl, {
            action: 'onp_get_order',
            nonce: onpData.nonce,
            last_seen_timestamp: lastSeenTimestamp
        }, function (res) {
            // Check if response is empty (no orders found)
            if (!res || res.trim() === '') {
                return; // Don't show anything if no orders found
            }

            try {
                let d = JSON.parse(res);

                // Check if this is a new order (different order ID than last displayed, or never displayed before)
                let isNewOrder = false;
                if (!lastDisplayedOrder || lastDisplayedOrder.order_id !== d.order_id) {
                    // This is a different order - check if we've seen it before
                    if (!shownOrderIds.includes(d.order_id)) {
                        isNewOrder = true;

                        // Update last seen timestamp
                        if (d.timestamp && d.timestamp > lastSeenTimestamp) {
                            lastSeenTimestamp = d.timestamp;
                            localStorage.setItem('onp_last_seen_timestamp', lastSeenTimestamp.toString());
                        }

                        // Add to shown orders list
                        shownOrderIds.push(d.order_id);
                        // Keep only last 100 order IDs
                        if (shownOrderIds.length > 100) {
                            shownOrderIds = shownOrderIds.slice(-100);
                        }
                        localStorage.setItem('onp_shown_order_ids', JSON.stringify(shownOrderIds));
                    }
                }
                // If same order ID as last displayed, it's a repeat (not new)

                // Store as last displayed order
                lastDisplayedOrder = d;
                localStorage.setItem('onp_last_displayed_order', JSON.stringify(d));

                // Display the popup (will show as "Recent Order" if not new)
                displayPopup(d, isNewOrder);
            } catch (e) {
                console.error('Error parsing order notification:', e);
            }
        }).fail(function (xhr, status, error) {
            // Silently fail
        });
    }

    // Function to show last displayed order (for 30-second repeat)
    function showLastOrder() {
        if (lastDisplayedOrder) {
            displayPopup(lastDisplayedOrder, false);
        }
    }

    // Show popup immediately on page load if there's a new order
    // Wait a bit first to ensure page is fully loaded
    setTimeout(function () {
        checkForOrders();
    }, 1000);

    // Poll for new orders at the configured interval (now in seconds)
    setInterval(checkForOrders, onpData.interval);

    // Show last displayed order every 30 seconds
    setInterval(showLastOrder, 30000);
});
