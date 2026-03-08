#!/bin/bash
# =============================================================================
# ICT LMS — Seed Test Data via API
# =============================================================================

set -e

API="https://apiict.zensbot.site/api/v1"
ADMIN_EMAIL="admin@ictlms.com"
ADMIN_PASS="admin123"
CURL_OPTS="--ssl-no-revoke"
DEFAULT_PW="Test@1234"

echo "============================================"
echo "  ICT LMS — Seeding Test Data"
echo "============================================"
echo ""

# Helper: extract JSON value by key
json_val() {
  echo "$1" | grep -o "\"$2\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed "s/\"$2\"[[:space:]]*:[[:space:]]*\"//;s/\"$//"
}

# ─── 1. Login as admin ───────────────────────────────────────────────────────
echo "-> Logging in as admin..."
LOGIN=$(curl -s $CURL_OPTS -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")

ADMIN_TOKEN=$(json_val "$LOGIN" "access_token")
if [ -z "$ADMIN_TOKEN" ]; then
  echo "X Login failed: $LOGIN"
  exit 1
fi
echo "OK Admin logged in"

CT="Content-Type: application/json"

# Helper: POST with given token, return id
create_with_token() {
  local token=$1
  local url=$2
  local body=$3
  local resp=$(curl -s $CURL_OPTS -X POST "$API$url" \
    -H "Authorization: Bearer $token" -H "$CT" -d "$body")
  local id=$(json_val "$resp" "id")
  if [ -z "$id" ]; then
    echo "FAILED"
    echo "  ERR: $(echo "$resp" | head -c 200)" >&2
  else
    echo "$id"
  fi
}

# Shortcut for admin token
create_admin() { create_with_token "$ADMIN_TOKEN" "$1" "$2"; }

# ─── 2. Create Users (admin can create users) ────────────────────────────────
echo ""
echo "-> Creating teachers..."
T1=$(create_admin "/users" "{\"name\":\"Ahmed Khan\",\"email\":\"ahmed.khan@ictlms.com\",\"password\":\"$DEFAULT_PW\",\"role\":\"teacher\",\"phone\":\"0300-1234567\",\"specialization\":\"Web Development\"}")
echo "  Ahmed Khan: $T1"
T2=$(create_admin "/users" "{\"name\":\"Sara Ali\",\"email\":\"sara.ali@ictlms.com\",\"password\":\"$DEFAULT_PW\",\"role\":\"teacher\",\"phone\":\"0321-9876543\",\"specialization\":\"Data Science\"}")
echo "  Sara Ali: $T2"
T3=$(create_admin "/users" "{\"name\":\"Usman Tariq\",\"email\":\"usman.tariq@ictlms.com\",\"password\":\"$DEFAULT_PW\",\"role\":\"teacher\",\"phone\":\"0333-5551234\",\"specialization\":\"Mobile App Development\"}")
echo "  Usman Tariq: $T3"

echo ""
echo "-> Creating course creators..."
CC1=$(create_admin "/users" "{\"name\":\"Fatima Zahra\",\"email\":\"fatima.z@ictlms.com\",\"password\":\"$DEFAULT_PW\",\"role\":\"course_creator\",\"phone\":\"0312-4445566\"}")
echo "  Fatima Zahra: $CC1"
CC2=$(create_admin "/users" "{\"name\":\"Hassan Raza\",\"email\":\"hassan.r@ictlms.com\",\"password\":\"$DEFAULT_PW\",\"role\":\"course_creator\",\"phone\":\"0345-7778899\"}")
echo "  Hassan Raza: $CC2"

echo ""
echo "-> Creating students..."
STUDENTS=()
SNAMES=("Ali Hamza" "Ayesha Siddiqui" "Bilal Ahmed" "Hira Malik" "Zain Ul Abideen" "Maham Nawaz" "Danish Iqbal" "Sana Fatima" "Faisal Shah" "Nimra Hassan")
SEMAILS=("ali.hamza" "ayesha.s" "bilal.a" "hira.m" "zain.ua" "maham.n" "danish.i" "sana.f" "faisal.s" "nimra.h")
SPHONES=("1111111" "2222222" "3333333" "4444444" "5555555" "6666666" "7777777" "8888888" "9999999" "1010101")

for i in "${!SNAMES[@]}"; do
  SID=$(create_admin "/users" "{\"name\":\"${SNAMES[$i]}\",\"email\":\"${SEMAILS[$i]}@ictlms.com\",\"password\":\"$DEFAULT_PW\",\"role\":\"student\",\"phone\":\"0300-${SPHONES[$i]}\"}")
  echo "  ${SNAMES[$i]}: $SID"
  STUDENTS+=("$SID")
done

# ─── 3. Login as course creator (needed for courses, curriculum, lectures, jobs)
echo ""
echo "-> Logging in as course creator (Fatima)..."
CC_LOGIN=$(curl -s $CURL_OPTS -X POST "$API/auth/login" \
  -H "$CT" -d "{\"email\":\"fatima.z@ictlms.com\",\"password\":\"$DEFAULT_PW\"}")
CC_TOKEN=$(json_val "$CC_LOGIN" "access_token")
if [ -z "$CC_TOKEN" ]; then
  echo "X CC login failed: $CC_LOGIN"
  exit 1
fi
echo "OK Course creator logged in"

# Shortcut for CC token
create_cc() { create_with_token "$CC_TOKEN" "$1" "$2"; }

# ─── 4. Create Courses (course_creator role) ─────────────────────────────────
echo ""
echo "-> Creating courses..."
C1=$(create_cc "/courses" '{"title":"Full Stack Web Development","description":"Complete web development course covering HTML, CSS, JavaScript, React, Node.js, and databases."}')
echo "  Web Dev: $C1"
C2=$(create_cc "/courses" '{"title":"Data Science with Python","description":"Learn data analysis, visualization, machine learning using Python, Pandas, NumPy, and Scikit-learn."}')
echo "  Data Science: $C2"
C3=$(create_cc "/courses" '{"title":"Mobile App Development","description":"Build cross-platform mobile applications using React Native and Flutter."}')
echo "  Mobile Dev: $C3"

# ─── 5. Create Batches (admin or course_creator) ─────────────────────────────
echo ""
echo "-> Creating batches..."
B1=$(create_admin "/batches" "{\"name\":\"Batch 1 - Web Development\",\"start_date\":\"2026-01-15\",\"end_date\":\"2026-06-15\",\"teacher_id\":\"$T1\"}")
echo "  Batch 1 (Web Dev): $B1"
B2=$(create_admin "/batches" "{\"name\":\"Batch 2 - Data Science\",\"start_date\":\"2026-02-01\",\"end_date\":\"2026-07-01\",\"teacher_id\":\"$T2\"}")
echo "  Batch 2 (Data Sci): $B2"
B3=$(create_admin "/batches" "{\"name\":\"Batch 3 - Mobile Dev\",\"start_date\":\"2026-04-01\",\"end_date\":\"2026-09-01\",\"teacher_id\":\"$T3\"}")
echo "  Batch 3 (Mobile): $B3"

# ─── 6. Link Courses to Batches ──────────────────────────────────────────────
echo ""
echo "-> Linking courses to batches..."
curl -s $CURL_OPTS -X POST "$API/batches/$B1/courses" -H "Authorization: Bearer $ADMIN_TOKEN" -H "$CT" -d "{\"course_id\":\"$C1\"}" > /dev/null && echo "  OK Web Dev -> Batch 1"
curl -s $CURL_OPTS -X POST "$API/batches/$B2/courses" -H "Authorization: Bearer $ADMIN_TOKEN" -H "$CT" -d "{\"course_id\":\"$C2\"}" > /dev/null && echo "  OK Data Science -> Batch 2"
curl -s $CURL_OPTS -X POST "$API/batches/$B3/courses" -H "Authorization: Bearer $ADMIN_TOKEN" -H "$CT" -d "{\"course_id\":\"$C3\"}" > /dev/null && echo "  OK Mobile Dev -> Batch 3"
curl -s $CURL_OPTS -X POST "$API/batches/$B2/courses" -H "Authorization: Bearer $ADMIN_TOKEN" -H "$CT" -d "{\"course_id\":\"$C1\"}" > /dev/null && echo "  OK Web Dev -> Batch 2 (cross-link)"

# ─── 7. Enroll Students ──────────────────────────────────────────────────────
echo ""
echo "-> Enrolling students..."
for i in 0 1 2 3; do
  curl -s $CURL_OPTS -X POST "$API/batches/$B1/students" -H "Authorization: Bearer $ADMIN_TOKEN" -H "$CT" -d "{\"student_id\":\"${STUDENTS[$i]}\"}" > /dev/null
done
echo "  OK 4 students -> Batch 1"
for i in 3 4 5 6; do
  curl -s $CURL_OPTS -X POST "$API/batches/$B2/students" -H "Authorization: Bearer $ADMIN_TOKEN" -H "$CT" -d "{\"student_id\":\"${STUDENTS[$i]}\"}" > /dev/null
done
echo "  OK 4 students -> Batch 2"
for i in 6 7 8 9; do
  curl -s $CURL_OPTS -X POST "$API/batches/$B3/students" -H "Authorization: Bearer $ADMIN_TOKEN" -H "$CT" -d "{\"student_id\":\"${STUDENTS[$i]}\"}" > /dev/null
done
echo "  OK 4 students -> Batch 3"

# ─── 8. Curriculum Modules (course_creator) ───────────────────────────────────
echo ""
echo "-> Creating curriculum modules..."
create_cc "/curriculum" "{\"course_id\":\"$C1\",\"title\":\"HTML & CSS Fundamentals\",\"description\":\"Learn the building blocks of the web\",\"topics\":[\"HTML5 Elements\",\"CSS Selectors\",\"Flexbox & Grid\",\"Responsive Design\"]}" > /dev/null && echo "  OK HTML & CSS"
create_cc "/curriculum" "{\"course_id\":\"$C1\",\"title\":\"JavaScript Essentials\",\"description\":\"Master modern JavaScript\",\"topics\":[\"Variables & Types\",\"Functions & Closures\",\"DOM Manipulation\",\"Async/Await\"]}" > /dev/null && echo "  OK JavaScript"
create_cc "/curriculum" "{\"course_id\":\"$C1\",\"title\":\"React Development\",\"description\":\"Build interactive UIs with React\",\"topics\":[\"Components & Props\",\"State Management\",\"Hooks\",\"React Router\"]}" > /dev/null && echo "  OK React"
create_cc "/curriculum" "{\"course_id\":\"$C2\",\"title\":\"Python for Data Science\",\"description\":\"Python fundamentals for data analysis\",\"topics\":[\"Python Basics\",\"NumPy Arrays\",\"Pandas DataFrames\",\"Data Cleaning\"]}" > /dev/null && echo "  OK Python DS"
create_cc "/curriculum" "{\"course_id\":\"$C2\",\"title\":\"Machine Learning\",\"description\":\"Core ML concepts and algorithms\",\"topics\":[\"Supervised Learning\",\"Unsupervised Learning\",\"Model Evaluation\",\"Feature Engineering\"]}" > /dev/null && echo "  OK Machine Learning"
create_cc "/curriculum" "{\"course_id\":\"$C3\",\"title\":\"React Native Basics\",\"description\":\"Cross-platform mobile development\",\"topics\":[\"Components\",\"Navigation\",\"Styling\",\"Native Modules\"]}" > /dev/null && echo "  OK React Native"

# ─── 9. Lectures (course_creator) ────────────────────────────────────────────
echo ""
echo "-> Creating lectures..."
create_cc "/lectures" "{\"title\":\"Introduction to HTML\",\"batch_id\":\"$B1\",\"course_id\":\"$C1\",\"video_type\":\"external\",\"video_url\":\"https://www.youtube.com/watch?v=qz0aGYrrlhU\",\"duration\":3600,\"description\":\"Learn the basics of HTML structure\"}" > /dev/null && echo "  OK Intro to HTML"
create_cc "/lectures" "{\"title\":\"CSS Box Model & Layout\",\"batch_id\":\"$B1\",\"course_id\":\"$C1\",\"video_type\":\"external\",\"video_url\":\"https://www.youtube.com/watch?v=rIO5326FgPE\",\"duration\":2700,\"description\":\"CSS box model, flexbox, and grid\"}" > /dev/null && echo "  OK CSS Box Model"
create_cc "/lectures" "{\"title\":\"JavaScript Fundamentals\",\"batch_id\":\"$B1\",\"course_id\":\"$C1\",\"video_type\":\"external\",\"video_url\":\"https://www.youtube.com/watch?v=PkZNo7MFNFg\",\"duration\":4200,\"description\":\"Variables, functions, core JS concepts\"}" > /dev/null && echo "  OK JS Fundamentals"
create_cc "/lectures" "{\"title\":\"React Components & Hooks\",\"batch_id\":\"$B1\",\"course_id\":\"$C1\",\"video_type\":\"external\",\"video_url\":\"https://www.youtube.com/watch?v=bMknfKXIFA8\",\"duration\":5400,\"description\":\"Building UIs with React\"}" > /dev/null && echo "  OK React Components"
create_cc "/lectures" "{\"title\":\"Python Data Analysis with Pandas\",\"batch_id\":\"$B2\",\"course_id\":\"$C2\",\"video_type\":\"external\",\"video_url\":\"https://www.youtube.com/watch?v=vmEHCJofslg\",\"duration\":3000,\"description\":\"Data manipulation with Pandas\"}" > /dev/null && echo "  OK Python Pandas"
create_cc "/lectures" "{\"title\":\"Data Visualization\",\"batch_id\":\"$B2\",\"course_id\":\"$C2\",\"video_type\":\"external\",\"video_url\":\"https://www.youtube.com/watch?v=UO98lJQ3QGI\",\"duration\":2400,\"description\":\"Charts and visualizations\"}" > /dev/null && echo "  OK Data Viz"
create_cc "/lectures" "{\"title\":\"Intro to Machine Learning\",\"batch_id\":\"$B2\",\"course_id\":\"$C2\",\"video_type\":\"external\",\"video_url\":\"https://www.youtube.com/watch?v=Gv9_4yMHFhI\",\"duration\":3600,\"description\":\"ML fundamentals and scikit-learn\"}" > /dev/null && echo "  OK Intro ML"
create_cc "/lectures" "{\"title\":\"React Native Setup\",\"batch_id\":\"$B3\",\"course_id\":\"$C3\",\"video_type\":\"external\",\"video_url\":\"https://www.youtube.com/watch?v=0-S5a0eXPoc\",\"duration\":2700,\"description\":\"Setting up RN and building first app\"}" > /dev/null && echo "  OK RN Setup"
create_cc "/lectures" "{\"title\":\"Navigation in React Native\",\"batch_id\":\"$B3\",\"course_id\":\"$C3\",\"video_type\":\"external\",\"video_url\":\"https://www.youtube.com/watch?v=npe3Wf4tpSg\",\"duration\":1800,\"description\":\"Implementing navigation patterns\"}" > /dev/null && echo "  OK RN Navigation"

# ─── 10. Jobs (course_creator) ────────────────────────────────────────────────
echo ""
echo "-> Creating job postings..."
create_cc "/jobs" '{"title":"Junior Web Developer","company":"TechCorp Pakistan","location":"Lahore","job_type":"full-time","salary":"PKR 80,000 - 120,000","description":"Looking for a motivated Junior Web Developer.","requirements":["HTML, CSS, JavaScript","React experience","Git"],"deadline":"2026-06-30"}' > /dev/null && echo "  OK Junior Web Dev"
create_cc "/jobs" '{"title":"Data Analyst Intern","company":"DataMinds Analytics","location":"Islamabad","job_type":"internship","salary":"PKR 40,000/month","description":"Join our data team as an intern.","requirements":["Python basics","SQL knowledge","Excel"],"deadline":"2026-05-15"}' > /dev/null && echo "  OK Data Analyst Intern"
create_cc "/jobs" '{"title":"Mobile App Developer","company":"AppFactory","location":"Remote","job_type":"full-time","salary":"PKR 150,000 - 200,000","description":"Build cross-platform mobile apps.","requirements":["React Native or Flutter","REST APIs","2+ years exp"],"deadline":"2026-07-31"}' > /dev/null && echo "  OK Mobile App Dev"
create_cc "/jobs" '{"title":"Frontend Developer","company":"DesignStudio","location":"Karachi","job_type":"part-time","salary":"PKR 50,000/month","description":"Part-time frontend role building responsive interfaces.","requirements":["React.js","Tailwind CSS","Responsive design"],"deadline":"2026-04-30"}' > /dev/null && echo "  OK Frontend Dev"

# ─── 11. Announcements (admin can create) ─────────────────────────────────────
echo ""
echo "-> Creating announcements..."
create_admin "/announcements" '{"title":"Welcome to ICT LMS!","content":"We are excited to launch our new Learning Management System. All students and teachers can now access their courses, lectures, and materials online.","scope":"institute","expires_at":"2026-12-31T23:59:59Z"}' > /dev/null && echo "  OK Welcome (institute-wide)"
create_admin "/announcements" "{\"title\":\"Batch 1 Schedule Update\",\"content\":\"Web Development batch classes will be held Mon/Wed/Fri 10 AM - 12 PM starting next week.\",\"scope\":\"batch\",\"batch_id\":\"$B1\",\"expires_at\":\"2026-04-30T23:59:59Z\"}" > /dev/null && echo "  OK Batch 1 schedule"

echo ""
echo "============================================"
echo "  Seed complete!"
echo "============================================"
echo ""
echo "Credentials (all passwords: $DEFAULT_PW):"
echo "  Admin:          admin@ictlms.com / admin123"
echo "  Teacher:        ahmed.khan@ictlms.com"
echo "  Teacher:        sara.ali@ictlms.com"
echo "  Teacher:        usman.tariq@ictlms.com"
echo "  Course Creator: fatima.z@ictlms.com"
echo "  Course Creator: hassan.r@ictlms.com"
echo "  Student:        ali.hamza@ictlms.com"
echo "  Student:        ayesha.s@ictlms.com"
echo "  (+ 8 more students)"
