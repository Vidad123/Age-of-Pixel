# Age of Pixel

An original browser-based medieval turn strategy prototype with a Warcraft
III–style main menu, account login, a static HTML/CSS/JS front end, and a
PHP/MySQL JSON API backend.

## Folder structure

```
ageofpixel/
├── database/
│   └── schema.sql          # run this once against your MySQL database
├── public/                  # <-- point your web server's document root here
│   ├── index.html           # redirects to login or dashboard (via JS)
│   ├── login.html
│   ├── register.html
│   ├── dashboard.html       # main menu (Single Player / Options / Credits / ...)
│   ├── play.html            # the battle screen (session-guarded)
│   ├── options.html
│   ├── credits.html
│   ├── api/                 # PHP JSON endpoints — the only PHP under public/
│   │   ├── session.php      # returns auth state + issues CSRF token
│   │   ├── register.php
│   │   ├── login.php
│   │   ├── logout.php
│   │   └── status.php
│   └── assets/
│       ├── css/
│       │   ├── auth.css       # login/register/options/credits theme
│       │   ├── dashboard.css  # main menu theme
│       │   └── game.css       # battle screen theme
│       └── js/
│           ├── app.js         # fetch/session/CSRF helpers (shared)
│           ├── auth.js         # login + register form handling
│           ├── dashboard.js    # dashboard guard, username, logout
│           ├── guard.js        # guard for play/options/credits pages
│           └── game.js         # battle logic (unchanged gameplay)
└── src/                     # PHP application code — NOT web-accessible
    ├── config.php            # DB credentials (env vars, with local fallback)
    ├── Database.php          # PDO connection
    └── auth.php              # session, register/login/logout, CSRF, JSON helpers
```

Every page in `public/` is plain HTML/CSS/JS except the five files under
`public/api/`, which are the PHP backend and only ever return JSON. `src/`
and `database/` sit outside the web root and are also protected by
`.htaccess` (`Require all denied`) as a second layer of safety.

## How the pieces talk to each other

- `assets/js/app.js` calls `GET /api/session.php` on every page load. That
  endpoint starts/reads the PHP session, returns `{ authenticated, user }`,
  and mirrors a CSRF token into a readable `csrf_token` cookie.
- Login and register forms (`auth.js`) POST JSON to `/api/login.php` and
  `/api/register.php`, sending the CSRF token back as an `X-CSRF-Token`
  header (double-submit pattern — the actual session cookie stays
  `httpOnly`).
- Protected pages (`dashboard.html`, `play.html`, `options.html`,
  `credits.html`) call `requireSession()` from `app.js`, which redirects to
  `/login.html` if the API says the visitor isn't authenticated. Each of
  those pages hides its `<body>` until that check resolves, so there's no
  flash of protected content — but keep in mind this is a **client-side**
  gate: the static HTML/CSS/JS for those pages is still delivered to
  anyone who requests the file directly. Real protection for the actual
  game state should live in server-side endpoints if/when you add
  gameplay APIs (saving progress, multiplayer, etc.).
- `Log Out` POSTs to `/api/logout.php`, which destroys the PHP session and
  clears the CSRF cookie.

## Setup

1. Import the schema — this creates the `AOP` database for you:
   ```
   mysql -u youruser -p < database/schema.sql
   ```
   For an existing installation, apply the role migration instead:
   ```
   mysql -u youruser -p < database/migrations/001_add_admin_role.sql
   ```
2. Configure credentials — either set environment variables on your server
   (`DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`) or edit the fallback values
   directly in `src/config.php`. The database name defaults to `AOP`.
3. Serve the `public/` folder. All links/scripts use relative paths, so this
   works either way:
   - **Plain XAMPP/htdocs style**: drop the whole `ageofpixel` project folder
     into `htdocs/` and visit `http://localhost/ageofpixel/public/`.
   - **Dedicated document root**: point an Apache `VirtualHost`
     `DocumentRoot` (or `php -S localhost:8000 -t public`) straight at
     `public/` and visit `http://localhost/` (or `:8000/`).
4. Visit the site — you'll land on `login.html`. Use **Create an account**
   to register, then sign in.
5. To create the admin account, register the username `admin`. Its database
   role is saved as `admin`, and the dashboard displays **Admin Editor** after
   login. Existing `admin` users are promoted by the migration. To approve
   another username during registration, set `ADMIN_USERS` to a comma-separated
   list before starting PHP. The protected admin entry is `/public/admin/`.

## HostForge deployment

1. Upload the complete `ageofpixel` folder into your HostForge web directory.
   Visit that folder's URL; the root entry point automatically opens `public/`.
2. In the HostForge database manager, create a MySQL database and user, grant
   that user all privileges on the database, select it in phpMyAdmin, then
   import `database/hostforge_import.sql`. It is the complete import for both
   fresh installs and older Age of Pixel databases. It does not create or
   switch databases, which shared hosting commonly blocks.
3. Copy `src/config.local.php.example` to `src/config.local.php` and replace
   its database host, name, username, and password with the exact values from
   HostForge. Shared hosts commonly prefix database and user names, so retain
   the full names shown in the control panel.
4. Use PHP 7.4 or newer with the PDO MySQL extension enabled. HTTPS is detected
   automatically, including when HostForge terminates HTTPS through a proxy.

The same package remains localhost-compatible. When `src/config.local.php` is
absent, it uses `127.0.0.1`, database `AOP`, user `root`, and an empty password.
Environment variables (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`,
`DB_CHARSET`, and `ADMIN_USERS`) override both sets of file-based values.

### HostForge container settings

When HostForge is set to the **Dockerfile** build type, use the following values
when this project is inside an `ageofpixel` folder in the repository:

- Dockerfile path: `ageofpixel/Dockerfile`
- Root directory: leave blank
- Build context: `ageofpixel`
- Install command: leave blank
- Start command: leave blank
- Port: `80`
- Health check path: `/api/status.php`
- Health check port: `80`

The supplied Dockerfile starts PHP 8.2 with Apache and PDO MySQL, and serves
only the `public/` directory.

The admin editor stores custom troops, uploaded PNG icons, and painted maps in
the browser's local storage. Content is immediately available to matches opened
in that browser. Creating a troop without an uploaded PNG reserves a generated
slug filename such as `giant.gif`; editing the troop lets you replace it with a
PNG.

## Gameplay features

- Worker, barbarian, archer, and spearman units
- Town Hall, Barracks, Gold Mine, Village, and Fortress buildings
- Training, construction, income, movement, combat, enemy turns, and win/loss states
- Responsive HTML/CSS/JavaScript interface
- `api/status.php` JSON status endpoint (also reports whether the caller is signed in)
