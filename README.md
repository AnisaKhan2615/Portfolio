# Personal Portfolio (Express + MySQL + jQuery AJAX)

## Run
1. Install Node.js 18+ and MySQL 8.
2. `npm install`
3. Copy `.env.example` to `.env` and set your MySQL password.
4. `npm start`, then open http://localhost:3000

The database and tables are created automatically (see `schema.sql`).
On first visit a welcome form asks for your profile. Use **Manage content** to add, edit and delete entries and upload images.

## API
| Method | Route | Purpose |
|---|---|---|
| GET | /api/portfolio | Load everything |
| PUT | /api/profile | Create/update profile and photo |
| POST | /api/:section | Add (skills, education, experience, projects) |
| PUT | /api/:section/:id | Update |
| DELETE | /api/:section/:id | Delete |

Queries are parameterised (no SQL injection). Server-side validation covers required fields, email, URLs and image type/size.
