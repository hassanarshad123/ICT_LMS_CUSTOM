"""Frappe app manifest for the Zensbot LMS connector.

Minimal app — only provides fixtures (custom fields + webhook template).
"""
app_name = "zensbot_lms_connector"
app_title = "Zensbot LMS Connector"
app_publisher = "Zensbot"
app_description = "Sync fees and payments from the Zensbot LMS into ERPNext."
app_email = "support@zensbot.com"
app_license = "MIT"

fixtures = [
    {"dt": "Custom Field", "filters": [["name", "in", [
        "Sales Invoice-zensbot_fee_plan_id",
        "Payment Entry-zensbot_fee_plan_id",
        "Payment Entry-zensbot_payment_id",
        "Sales Order-zensbot_fee_plan_id",
        "Sales Order-zensbot_payment_id",
        "Sales Order-zensbot_payment_proof_url",
    ]]]},
]
