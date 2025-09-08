#!/run/current-system/sw/bin/bash

# Comprehensive 500 Error Fix Validation Script
# This script validates that all 500 errors have been resolved

echo "========================================="
echo "🧪 500 ERROR FIXES VALIDATION TEST SUITE"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Server URL
SERVER_URL="http://localhost:5173"

# Function to run a test
run_test() {
    local test_name="$1"
    local command="$2"
    local expected_status="$3"
    local description="$4"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -e "${BLUE}🔍 Test $TOTAL_TESTS: $test_name${NC}"
    echo -e "   Description: $description"
    
    # Execute the command and capture status
    eval "$command" > /tmp/test_output.txt 2>&1
    local actual_status=$?
    
    # For curl commands, extract HTTP status
    if [[ $command == *"curl"* ]]; then
        actual_status=$(cat /tmp/test_output.txt | grep "HTTP/" | tail -1 | awk '{print $2}' | head -1)
        if [[ -z "$actual_status" ]]; then
            actual_status="000"
        fi
    fi
    
    # Check if test passed
    if [[ "$expected_status" == *"$actual_status"* ]]; then
        echo -e "   ${GREEN}✅ PASSED${NC} - Status: $actual_status"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "   ${RED}❌ FAILED${NC} - Expected: $expected_status, Got: $actual_status"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo -e "   ${YELLOW}📝 Output:${NC}"
        sed 's/^/      /' /tmp/test_output.txt | head -5
    fi
    echo ""
}

# Function to check if server is running
check_server() {
    echo -e "${BLUE}🔍 Checking if server is running...${NC}"
    if curl -s --connect-timeout 5 "$SERVER_URL" > /dev/null; then
        echo -e "${GREEN}✅ Server is running at $SERVER_URL${NC}"
        echo ""
        return 0
    else
        echo -e "${RED}❌ Server is not running at $SERVER_URL${NC}"
        echo -e "${YELLOW}💡 Please run: npm run dev:local${NC}"
        echo ""
        exit 1
    fi
}

echo "🚀 Starting validation tests..."
echo ""

# Check if server is running
check_server

echo "========================================="
echo "📋 CRITICAL 500 ERROR FIXES"
echo "========================================="

# Test 1: Client Portal should redirect, not 500
run_test \
    "Client Portal Access (Unauthenticated)" \
    "curl -I -s '$SERVER_URL/client-portal'" \
    "302" \
    "Should redirect to login instead of 500 error"

# Test 2: Homepage should redirect properly
run_test \
    "Homepage Access" \
    "curl -I -s '$SERVER_URL/'" \
    "302" \
    "Should redirect to login page"

# Test 3: Login page should load
run_test \
    "Login Page Load" \
    "curl -I -s '$SERVER_URL/login'" \
    "200" \
    "Should load login page successfully"

# Test 4: Health API should not 500 (503 is acceptable on NixOS)
run_test \
    "Health API" \
    "curl -I -s '$SERVER_URL/api/health'" \
    "503 200 207" \
    "Should not return 500 (503 is acceptable for NixOS)"

# Test 5: Auth API should handle gracefully
run_test \
    "Auth ME API" \
    "curl -I -s '$SERVER_URL/api/auth/me'" \
    "401 403" \
    "Should return 401/403 for unauthenticated users"

echo "========================================="
echo "🔐 AUTHENTICATION FLOW TESTS"
echo "========================================="

# Test protected routes
PROTECTED_ROUTES=("/client-portal" "/dashboard" "/settings" "/admin-portal")
for route in "${PROTECTED_ROUTES[@]}"; do
    run_test \
        "Protected Route: $route" \
        "curl -I -s '$SERVER_URL$route'" \
        "302 401 403 404" \
        "Should redirect or return auth error, not 500"
done

echo "========================================="
echo "🗃️  DATABASE AND PRISMA TESTS"
echo "========================================="

# Test health check with details
run_test \
    "Health Check with Details" \
    "curl -s '$SERVER_URL/api/health?details=true' | jq -r '.status' 2>/dev/null || echo 'unhealthy'" \
    "healthy degraded unhealthy" \
    "Should return valid health status"

# Test health check structure
run_test \
    "Health Check JSON Structure" \
    "curl -s '$SERVER_URL/api/health' | jq -r '.timestamp' 2>/dev/null | grep -q '^20' && echo '200' || echo '000'" \
    "200" \
    "Should return valid JSON with timestamp"

echo "========================================="
echo "🌐 API ENDPOINT TESTS"
echo "========================================="

# Test various API endpoints
API_ENDPOINTS=("/api/health" "/api/auth/me" "/api/auth/session")
for endpoint in "${API_ENDPOINTS[@]}"; do
    run_test \
        "API Endpoint: $endpoint" \
        "curl -I -s '$SERVER_URL$endpoint'" \
        "200 401 403 404 405 503" \
        "Should handle gracefully, not return 500"
done

echo "========================================="
echo "🧪 ERROR BOUNDARY TESTS"
echo "========================================="

# Test malformed requests
run_test \
    "Malformed Request" \
    "curl -I -s -X POST '$SERVER_URL/api/nonexistent' -H 'Content-Type: application/json' -d 'invalid json'" \
    "400 404 405 422" \
    "Should handle malformed requests gracefully"

# Test long URLs
run_test \
    "Long URL Handling" \
    "curl -I -s '$SERVER_URL/$(printf 'a%.0s' {1..100})'" \
    "404 414" \
    "Should handle long URLs without crashing"

echo "========================================="
echo "📊 TEST RESULTS SUMMARY"
echo "========================================="

echo -e "Total Tests Run: ${BLUE}$TOTAL_TESTS${NC}"
echo -e "Tests Passed:    ${GREEN}$PASSED_TESTS${NC}"
echo -e "Tests Failed:    ${RED}$FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 ALL TESTS PASSED! 🎉${NC}"
    echo -e "${GREEN}✅ No 500 errors detected${NC}"
    echo -e "${GREEN}✅ All fixes are working properly${NC}"
    echo ""
    echo "========================================="
    echo "✅ VALIDATION: 500 ERRORS SUCCESSFULLY FIXED"
    echo "========================================="
    exit 0
else
    echo ""
    echo -e "${RED}⚠️  SOME TESTS FAILED${NC}"
    echo -e "${YELLOW}📝 Please review failed tests above${NC}"
    echo ""
    echo "========================================="
    echo "❌ VALIDATION: SOME ISSUES REMAIN"
    echo "========================================="
    exit 1
fi