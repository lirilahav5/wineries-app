# 🎯 Management App Plan for wineME

## Overview
Create a management application that allows winery and shop managers to log in and update their business information, which will automatically reflect in the main user-facing app.

---

## ✅ Is This Possible?
**YES!** This is absolutely possible and a great feature. Here's why:
- ✅ Supabase has built-in authentication (already configured in your project)
- ✅ React Router supports protected routes
- ✅ Same database = automatic updates in main app
- ✅ Can be built in the same project (recommended)

---

## 🏗️ Architecture Decision

### **Recommended: Same Project with Protected Routes**

**Why same project?**
- ✅ Single codebase to maintain
- ✅ Share components, contexts, and utilities
- ✅ Single deployment
- ✅ Automatic updates (same database)
- ✅ Easier to keep UI consistent

**Structure:**
```
wineries-app/
├── src/
│   ├── pages/
│   │   ├── Home.tsx (public)
│   │   ├── WineriesMap.tsx (public)
│   │   ├── admin/
│   │   │   ├── Login.tsx (public admin route)
│   │   │   ├── Dashboard.tsx (protected)
│   │   │   └── EditWinery.tsx (protected)
│   │   │   └── EditShop.tsx (protected)
│   ├── components/
│   │   └── ProtectedRoute.tsx (new)
│   ├── contexts/
│   │   └── AuthContext.tsx (new)
│   └── lib/
│       └── supabase.ts (already exists)
```

**Alternative: Separate Project**
- ❌ More maintenance (two codebases)
- ❌ Need to sync dependencies
- ❌ Separate deployments
- ✅ Complete separation of concerns
- ✅ Different URLs (e.g., `app.wineme.com` vs `admin.wineme.com`)

**Recommendation: Same project** ✅

---

## 📋 Implementation Plan

### Phase 1: Database Setup

#### 1.1 Create `managers` Table
Link Supabase users to wineries/shops:

```sql
CREATE TABLE managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('winery', 'wine_shop')),
  entity_id BIGINT NOT NULL, -- References wineries.id or wine_shops.id
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, entity_type, entity_id)
);

-- Index for fast lookups
CREATE INDEX idx_managers_user_id ON managers(user_id);
CREATE INDEX idx_managers_entity ON managers(entity_type, entity_id);
```

#### 1.2 Enable Row Level Security (RLS)
```sql
-- Managers can only see their own records
CREATE POLICY "Managers can view own records"
  ON managers FOR SELECT
  USING (auth.uid() = user_id);

-- Managers can update their own records
CREATE POLICY "Managers can update own records"
  ON managers FOR UPDATE
  USING (auth.uid() = user_id);
```

#### 1.3 Enable RLS on wineries/wine_shops for updates
```sql
-- Allow managers to update their winery/shop
CREATE POLICY "Managers can update their winery"
  ON wineries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM managers
      WHERE managers.user_id = auth.uid()
      AND managers.entity_type = 'winery'
      AND managers.entity_id = wineries.id
    )
  );

-- Similar for wine_shops
CREATE POLICY "Managers can update their shop"
  ON wine_shops FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM managers
      WHERE managers.user_id = auth.uid()
      AND managers.entity_type = 'wine_shop'
      AND managers.entity_id = wine_shops.id
    )
  );
```

---

### Phase 2: Authentication System

#### 2.1 Create AuthContext
- Manage user session
- Provide login/logout functions
- Check if user is manager
- Get manager's entity (winery/shop)

#### 2.2 Create ProtectedRoute Component
- Redirect to login if not authenticated
- Check if user has manager access
- Redirect to appropriate dashboard

#### 2.3 Create Login Page
- Email/password login
- Error handling
- Redirect to dashboard after login

---

### Phase 3: Management Interface

#### 3.1 Dashboard Page
- Show manager's winery/shop info
- Quick stats
- Link to edit page
- Logout button

#### 3.2 Edit Winery/Shop Page
**Editable Fields:**
- ✅ Name
- ✅ Address
- ✅ Phone
- ✅ Website
- ✅ Opening Hours (formatted input)
- ✅ Kosher (checkbox)
- ✅ Offers (text area)
- ❌ Region (probably shouldn't change)
- ❌ Lat/Lng (auto-set, maybe manual override)

**Features:**
- Form validation
- Save button
- Success/error messages
- Preview changes
- Cancel button

---

### Phase 4: Routing & Navigation

#### 4.1 Add Admin Routes
```tsx
<Route path="/admin/login" element={<Login />} />
<Route path="/admin/dashboard" element={
  <ProtectedRoute>
    <Dashboard />
  </ProtectedRoute>
} />
<Route path="/admin/edit" element={
  <ProtectedRoute>
    <EditEntity />
  </ProtectedRoute>
} />
```

#### 4.2 Auto-redirect Logic
- If manager logs in → redirect to `/admin/dashboard`
- Dashboard checks entity type → shows appropriate edit page
- If not manager → redirect to home

---

## 🎨 UI/UX Considerations

### Design Consistency
- Use same theme system (light/dark mode)
- Use same language system (Hebrew/English/Russian)
- Match main app styling
- Add "Admin" indicator in header

### User Experience
- Clear login form
- Loading states
- Success/error notifications
- Confirmation before saving
- Mobile-responsive

---

## 🔒 Security Considerations

1. **Authentication**: Supabase Auth handles this
2. **Authorization**: RLS policies ensure managers can only edit their own entity
3. **Input Validation**: Validate all form inputs
4. **Rate Limiting**: Consider adding rate limits (Supabase handles some)
5. **Session Management**: Auto-logout after inactivity (optional)

---

## 📝 Step-by-Step Implementation

### Step 1: Database Setup (SQL)
1. Create `managers` table
2. Set up RLS policies
3. Create test manager account (optional)

### Step 2: Authentication Context
1. Create `AuthContext.tsx`
2. Add login/logout functions
3. Add session management

### Step 3: Protected Routes
1. Create `ProtectedRoute.tsx` component
2. Add route protection logic

### Step 4: Login Page
1. Create `admin/Login.tsx`
2. Style login form
3. Add error handling

### Step 5: Dashboard
1. Create `admin/Dashboard.tsx`
2. Fetch manager's entity
3. Display current info
4. Add edit button

### Step 6: Edit Pages
1. Create `admin/EditWinery.tsx`
2. Create `admin/EditShop.tsx`
3. Add form with all editable fields
4. Add save functionality

### Step 7: Testing
1. Test login flow
2. Test editing
3. Test permissions
4. Test on mobile

---

## 🚀 Getting Started

**Would you like me to:**
1. ✅ Start implementing now (I'll create all the files)
2. ✅ Set up the database tables first
3. ✅ Create a test manager account
4. ✅ Build the UI step by step

**Tell me when you're ready and I'll begin!**

---

## 📊 Database Schema Summary

### New Table: `managers`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | References auth.users |
| entity_type | TEXT | 'winery' or 'wine_shop' |
| entity_id | BIGINT | ID of winery or shop |
| created_at | TIMESTAMP | Auto-set |
| updated_at | TIMESTAMP | Auto-updated |

### Modified Tables
- `wineries` - Add RLS policy for updates
- `wine_shops` - Add RLS policy for updates

---

## ❓ Questions to Consider

1. **How do managers get accounts?**
   - Option A: You create them manually in Supabase
   - Option B: Self-registration with approval
   - Option C: Invite system (future feature)

2. **Can one manager manage multiple entities?**
   - Current plan: One manager = One entity
   - Can be extended later

3. **What happens if a manager is removed?**
   - RLS prevents access
   - Could add `is_active` flag

4. **Should managers see analytics?**
   - Future feature
   - Views, clicks, etc.

---

## ✅ Next Steps

**Ready to start?** Tell me:
1. "Let's start with the database setup"
2. "Create the authentication system"
3. "Build everything step by step"
4. Or ask any questions!

I'll guide you through each step and create all the necessary files! 🚀
