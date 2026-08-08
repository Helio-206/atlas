alter type procurement.purchase_request_status
  add value if not exists 'supplier_selected' after 'approved';
