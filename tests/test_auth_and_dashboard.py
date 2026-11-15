"""Test suite verifying Auth Module, Login Page, and Light NASA Dashboard Styling."""

import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

def test_auth_js():
    auth_path = BASE_DIR / "static" / "js" / "auth.js"
    assert auth_path.exists(), "static/js/auth.js missing"
    content = auth_path.read_text(encoding="utf-8")
    assert "export function login" in content
    assert "export function registerUser" in content
    assert "export function isAuthenticated" in content
    assert "export function getCurrentUser" in content
    assert "export function logout" in content
    assert "export function requireAuth" in content
    assert "earth-analogs" in content
    print("  [PASS] static/js/auth.js functions & default accounts verified")

def test_login_html():
    login_path = BASE_DIR / "static" / "login.html"
    assert login_path.exists(), "static/login.html missing"
    content = login_path.read_text(encoding="utf-8")
    assert 'id="inputUsername"' in content
    assert 'id="inputPassword"' in content
    assert 'id="btnQuickDemo"' in content
    assert 'id="tabSignIn"' in content
    assert 'id="tabRegister"' in content
    assert 'from "/js/auth.js"' in content
    assert 'Space+Grotesk' in content or 'Space Grotesk' in content
    assert 'earth_analogs_logo.png' in content
    print("  [PASS] static/login.html structure, fields, and styling verified")

def test_workbench_html():
    wb_path = BASE_DIR / "static" / "workbench.html"
    assert wb_path.exists(), "static/workbench.html missing"
    content = wb_path.read_text(encoding="utf-8")
    assert 'requireAuth()' in content
    assert 'id="userSessionWidget"' in content
    assert 'id="btnLogout"' in content
    assert 'Space+Grotesk' in content or 'Space Grotesk' in content
    assert 'styles.css' in content
    print("  [PASS] static/workbench.html auth guard & user session verified")

def test_dashboard_css():
    css_path = BASE_DIR / "static" / "styles.css"
    assert css_path.exists(), "static/styles.css missing"
    content = css_path.read_text(encoding="utf-8")
    assert "#F5F9FC" in content, "Dashboard background must be light canvas #F5F9FC"
    assert "#078FE0" in content, "Dashboard primary must be NASA electric blue #078FE0"
    assert "#E87532" in content, "Dashboard accent must be Mars orange #E87532"
    assert "Space Grotesk" in content, "Dashboard must use Space Grotesk"
    assert ".user-session-widget" in content
    assert ".btn-signout" in content
    print("  [PASS] static/styles.css NASA light palette & typography verified")

def test_routes():
    server_py = (BASE_DIR / "server.py").read_text(encoding="utf-8")
    assert "/login" in server_py, "server.py must route /login"
    
    netlify_toml = (BASE_DIR / "netlify.toml").read_text(encoding="utf-8")
    assert 'from = "/login"' in netlify_toml, "netlify.toml must route /login"
    print("  [PASS] /login routes in server.py and netlify.toml verified")

if __name__ == "__main__":
    print("=== TESTING AUTH & DASHBOARD INTEGRATION ===")
    test_auth_js()
    test_login_html()
    test_workbench_html()
    test_dashboard_css()
    test_routes()
    print(">>> ALL AUTH & DASHBOARD TESTS PASSED SUCCESSFULLY! <<<")
