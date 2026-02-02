<?php
/*
Plugin Name: Order Notification Popup
Description: WooCommerce order notification popup with settings.
Version: 2.1
Author: sptechbd
Author URI: https://sptechbd.com/
*/

if (!defined('ABSPATH')) exit;

register_activation_hook(__FILE__, function () {
    add_option('onp_enable', 1);
    add_option('onp_interval', 15); // Default to 15 seconds for real-time updates
    add_option('onp_home_only', 1);
});

// Demo mode removed: clean up old saved option if present.
add_action('init', function () {
    if (get_option('onp_demo', null) !== null) {
        delete_option('onp_demo');
    }
});

add_action('wp_enqueue_scripts', function () {

    if (!class_exists('WooCommerce')) return;
    if (!get_option('onp_enable')) return;
    if (get_option('onp_home_only') && !is_front_page()) return;

    wp_enqueue_style('onp-style', plugin_dir_url(__FILE__) . 'assets/style.css');

    wp_enqueue_script(
        'onp-script',
        plugin_dir_url(__FILE__) . 'assets/script.js',
        array('jquery'),
        null,
        true
    );

    wp_localize_script('onp-script', 'onpData', array(
        'ajaxurl' => admin_url('admin-ajax.php'),
        'interval' => get_option('onp_interval') * 1000 // Convert to milliseconds (interval is now in seconds)
    ));
});

add_action('wp_ajax_onp_get_order', 'onp_get_order');
add_action('wp_ajax_nopriv_onp_get_order', 'onp_get_order');

function onp_get_order() {

    $last_seen_timestamp = isset($_POST['last_seen_timestamp']) ? intval($_POST['last_seen_timestamp']) : 0;
    $current_time = current_time('timestamp');
    
    // Get the most recent order
    $orders = wc_get_orders(array(
        'limit' => 1,
        'status' => array('processing', 'completed'),
        'orderby' => 'date',
        'order' => 'DESC'
    ));

    if (!$orders) wp_die();

    $order = $orders[0];
    $order_id = $order->get_id();
    $order_timestamp = $order->get_date_created()->getTimestamp();
    
    // Always return the latest order (so time can be refreshed)
    // JavaScript will handle whether to show it as new or repeated
    // But on first load, only show orders from the last 5 minutes to avoid showing very old orders
    if ($last_seen_timestamp === 0 && $order_timestamp < ($current_time - 300)) {
        wp_die(); // Don't show orders older than 5 minutes on first load
    }
    
    $name = $order->get_billing_first_name();
    $masked = substr($name, 0, 2) . "****";

    $item = current($order->get_items());
    if (!$item) {
        wp_die();
    }

    echo json_encode(array(
        // Send real order id (frontend hides it visually)
        'order_id' =>$order_id,
        'name' => $masked,
        'product' => $item->get_name(),
        'amount' => wc_price($order->get_total()),
        'timestamp' => $order_timestamp
    ));
    wp_die();
}

add_action('admin_menu', function () {
    add_options_page(
        'Order Notification',
        'Order Notification',
        'manage_options',
        'onp-settings',
        'onp_settings_page'
    );
});

function onp_settings_page() { ?>
    <div class="wrap">
        <h1>Order Notification Popup</h1>
        <form method="post" action="options.php">
            <?php settings_fields('onp_settings'); ?>
            <table class="form-table">
                <tr>
                    <th>Enable Popup</th>
                    <td><input type="checkbox" name="onp_enable" value="1" <?php checked(1, get_option('onp_enable')); ?>></td>
                </tr>
                <tr>
                    <th>Check Interval (seconds)</th>
                    <td>
                        <select name="onp_interval">
                            <option value="10" <?php selected(10, get_option('onp_interval')); ?>>10 seconds</option>
                            <option value="15" <?php selected(15, get_option('onp_interval')); ?>>15 seconds</option>
                            <option value="30" <?php selected(30, get_option('onp_interval')); ?>>30 seconds</option>
                            <option value="60" <?php selected(60, get_option('onp_interval')); ?>>1 minute</option>
                        </select>
                        <p class="description">How often to check for new orders. Lower values = more real-time but more server requests.</p>
                    </td>
                </tr>
                <tr>
                    <th>Show Only Home Page</th>
                    <td><input type="checkbox" name="onp_home_only" value="1" <?php checked(1, get_option('onp_home_only')); ?>></td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
    </div>
<?php }

add_action('admin_init', function () {
    register_setting('onp_settings', 'onp_enable');
    register_setting('onp_settings', 'onp_interval');
    register_setting('onp_settings', 'onp_home_only');
});
