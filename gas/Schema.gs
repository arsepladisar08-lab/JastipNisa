var JN_TABLE_SCHEMA = {
  Settings: ['setting_key', 'setting_value', 'is_public', 'updated_at', 'updated_by'],
  Catalog: ['product_id', 'name', 'slug', 'category', 'official_price', 'official_url', 'image_url', 'source_checked_at', 'is_active', 'sort_order', 'created_at', 'updated_at'],
  Variants: ['variant_id', 'product_id', 'name', 'image_url', 'is_active', 'created_at', 'updated_at'],
  Buyers: ['buyer_id', 'name', 'phone', 'phone_normalized', 'address', 'shopee_username', 'notes', 'created_at', 'updated_at'],
  Request_Groups: ['request_group_id', 'request_code', 'client_submission_id', 'buyer_id', 'status', 'access_token_hash', 'access_token_created_at', 'access_token_revoked_at', 'order_id', 'payload_hash', 'created_at', 'updated_at'],
  Requests: ['request_id', 'request_group_id', 'product_id', 'variant_id', 'product_name_snapshot', 'variant_name_snapshot', 'quantity', 'notes', 'status', 'actual_photo_file_ids_json', 'actual_condition', 'customer_decision', 'unit_ids_json', 'created_at', 'updated_at'],
  Units: ['unit_id', 'unit_code', 'product_id', 'variant_id', 'actual_photo_file_ids_json', 'condition_notes', 'receipt_reference', 'purchase_price', 'selling_price', 'status', 'held_request_id', 'reserved_order_id', 'created_at', 'updated_at'],
  Orders: ['order_id', 'order_code', 'request_group_id', 'buyer_id', 'customer_name', 'customer_phone', 'shipping_address', 'shopee_username', 'shopee_checkout_url', 'product_count', 'product_subtotal', 'jastip_fee', 'shipping_fee', 'discount', 'total_amount', 'status', 'payment_status', 'courier', 'tracking_number', 'shipped_at', 'delivered_at', 'created_at', 'updated_at'],
  Order_Items: ['order_item_id', 'order_id', 'request_id', 'unit_id', 'product_id', 'variant_id', 'product_name_snapshot', 'variant_name_snapshot', 'quantity', 'unit_price', 'status', 'created_at'],
  Payments: ['payment_id', 'request_group_id', 'request_id', 'order_id', 'type', 'amount', 'method', 'proof_file_id', 'verification_status', 'verified_at', 'verified_by', 'idempotency_key', 'occurred_at', 'notes', 'created_at'],
  Shipments: ['shipment_id', 'order_id', 'courier', 'tracking_number', 'status', 'processed_at', 'shipped_at', 'delivered_at', 'notes', 'created_at', 'updated_at'],
  Expenses: ['expense_id', 'occurred_at', 'category', 'description', 'amount', 'order_id', 'event_id', 'created_by', 'created_at', 'idempotency_key'],
  Events: ['event_id', 'name', 'event_date', 'location', 'status', 'notes', 'created_at', 'updated_at'],
  Audit_Log: ['audit_id', 'actor_type', 'actor_id', 'action', 'entity_type', 'entity_id', 'details_json', 'created_at']
}

var JN_PRIMARY_KEYS = {
  Settings: 'setting_key',
  Catalog: 'product_id',
  Variants: 'variant_id',
  Buyers: 'buyer_id',
  Request_Groups: 'request_group_id',
  Requests: 'request_id',
  Units: 'unit_id',
  Orders: 'order_id',
  Order_Items: 'order_item_id',
  Payments: 'payment_id',
  Shipments: 'shipment_id',
  Expenses: 'expense_id',
  Events: 'event_id',
  Audit_Log: 'audit_id'
}

var JN_DEFAULT_SETTINGS = [
  { setting_key: 'service_name', setting_value: 'JastipNisa', is_public: true },
  { setting_key: 'admin_whatsapp', setting_value: '', is_public: true },
  { setting_key: 'public_notice', setting_value: 'Katalog merupakan referensi model. Ketersediaan dan kondisi barang tetap dikonfirmasi admin.', is_public: true },
  { setting_key: 'packing_estimate', setting_value: '2–3 hari kerja', is_public: true },
  { setting_key: 'fee_rule_version', setting_value: '2026-11', is_public: true },
  { setting_key: 'currency', setting_value: 'IDR', is_public: true }
]
