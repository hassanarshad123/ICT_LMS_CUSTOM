"""Structural assertions on the admin billing router (PR 4).

These tests don't call the endpoints — they inspect the FastAPI router
object to confirm the right paths + methods exist and the right helper
functions are wired up. This catches "I deleted an endpoint by accident"
regressions without needing a running server.
"""
from app.routers import billing as billing_router
from app.routers.billing import router


def _routes_by_path() -> dict[str, list[str]]:
    """Map path → list of HTTP methods registered on it."""
    mapping: dict[str, list[str]] = {}
    for route in router.routes:
        if hasattr(route, "path") and hasattr(route, "methods"):
            mapping.setdefault(route.path, []).extend(route.methods or [])
    return mapping


class TestRouterStructure:
    def test_overview_endpoint_registered(self):
        routes = _routes_by_path()
        assert "/overview" in routes
        assert "GET" in routes["/overview"]

    def test_invoice_list_endpoint_registered(self):
        routes = _routes_by_path()
        assert "/invoices" in routes
        assert "GET" in routes["/invoices"]

    def test_invoice_detail_endpoint_registered(self):
        routes = _routes_by_path()
        assert "/invoices/{invoice_id}" in routes
        assert "GET" in routes["/invoices/{invoice_id}"]

    def test_invoice_download_endpoint_registered(self):
        routes = _routes_by_path()
        assert "/invoices/{invoice_id}/download" in routes
        assert "GET" in routes["/invoices/{invoice_id}/download"]

    def test_payments_endpoint_registered(self):
        routes = _routes_by_path()
        assert "/payments" in routes
        assert "GET" in routes["/payments"]

    def test_addons_list_endpoint_registered(self):
        routes = _routes_by_path()
        assert "/addons" in routes
        assert "GET" in routes["/addons"]

    def test_addon_activate_endpoint_registered(self):
        routes = _routes_by_path()
        assert "/addons" in routes
        assert "POST" in routes["/addons"]

    def test_addon_cancel_endpoint_registered(self):
        routes = _routes_by_path()
        assert "/addons/{addon_id}" in routes
        assert "DELETE" in routes["/addons/{addon_id}"]


class TestTierGateHelperWiredUp:
    """Defense-in-depth: the tier gate must be importable and the
    internal helper must exist on the router module, so future refactors
    don't accidentally delete it."""

    def test_require_v2_tier_helper_exists(self):
        assert hasattr(billing_router, "_require_v2_tier")
        assert callable(billing_router._require_v2_tier)

    def test_billing_config_guard_helper_exists(self):
        assert hasattr(billing_router, "_get_billing_or_400")
        assert callable(billing_router._get_billing_or_400)


class TestBillingRestrictionWiredIntoWriterRouters:
    """PR 4 also wires check_billing_restriction into users/materials/lectures
    routers. Regression guard: if someone deletes the import, this test fails
    at collection time (module-level assertion)."""

    def test_users_router_imports_check_billing_restriction(self):
        from app.routers import users as users_router
        assert hasattr(users_router, "check_billing_restriction")

    def test_materials_router_imports_check_billing_restriction(self):
        from app.routers import materials as materials_router
        assert hasattr(materials_router, "check_billing_restriction")

    def test_lectures_router_imports_check_billing_restriction(self):
        from app.routers import lectures as lectures_router
        assert hasattr(lectures_router, "check_billing_restriction")
