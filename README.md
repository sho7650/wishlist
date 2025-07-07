# Tanabata Wish Board

A modern, digital re-imagination of the traditional Japanese Tanabata wish-making custom. This web application allows users from anywhere to post their wishes on a virtual bamboo tree, sharing their hopes and dreams in a beautiful, interactive display.

The project is built with a clean, scalable architecture (Hexagonal Architecture and DDD) and is ready for deployment on Heroku.

_(Note: Replace this with an actual screenshot of your application)_

## Features

- **Post a Wish**: Users can anonymously or with a name post their "negaigoto" (wish).
- **Edit Your Wish**: A session cookie allows users to edit the wish they've posted. A user can only have one wish per session.
- **Dynamic Wish Wall**: View the latest wishes from users around the world, displayed in beautifully colored, random cards.
- **Infinite Scroll**: Seamlessly load and browse through past wishes by simply scrolling down the page.
- **Separated Views**: A dedicated read-only page for browsing wishes and a separate page for posting or editing a wish.
- **Responsive Design**: Enjoy a seamless experience on both desktop and mobile devices.

## Tech Stack & Architecture

This project emphasizes a clean, decoupled, and scalable codebase through its architecture.

- **Architecture**:

  - **Hexagonal Architecture (Ports and Adapters)**: Decouples the core application logic from external concerns like the database, web server, and other services.
  - **Domain-Driven Design (DDD)**: The business logic is modeled around a rich domain layer, focusing on the core concepts of "Wishes" and their rules.

- **Backend**:

  - **Language**: TypeScript
  - **Framework**: Node.js with Express.js
  - **Database**:
    - **PostgreSQL**: For production environments (Heroku compatible).
    - **SQLite**: For easy local development and testing.
  - **Testing**: Jest, Supertest

- **Frontend**:

  - **Structure**: Single Page Application (SPA)
  - **Technologies**: HTML5, CSS3, vanilla JavaScript

- **Deployment**:
  - **Platform**: Heroku
  - **Process**: Includes a `Procfile` and is configured for seamless deployment with the Heroku Postgres add-on.

## Project Structure

The codebase is organized following the principles of Hexagonal Architecture.

```
.
├── src/
│   ├── domain/         # Core business logic (Entities, Repositories)
│   ├── application/    # Use cases that orchestrate the domain
│   ├── infrastructure/ # External concerns (DB connection, Web server)
│   ├── adapters/       # Connects infrastructure to ports (Controllers, DB Repositories)
│   ├── ports/          # Interfaces defining communication contracts
│   └── index.ts        # Application entry point
├── public/             # Frontend static files (HTML, CSS, JS)
├── tests/              # Unit, Integration, and E2E tests
├── jest.config.js      # Jest testing configuration
└── package.json
```

## Getting Started

Follow these instructions to get the project up and running on your local machine for development and testing.

### Prerequisites

- Node.js (v18.x or later recommended)
- npm (v9.x or later recommended)
- Git

### Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/sho7650/wishlist.git
    cd wishlist
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the root of the project by copying the example file.

    ```bash
    touch .env
    ```

    Open the `.env` file and configure it for your desired database.

    **For SQLite (default for development):**

    ```env
    # .env
    DB_TYPE=sqlite
    SQLITE_DB_PATH=./data/wishlist-dev.sqlite
    ```

    **For PostgreSQL (requires a running instance):**

    ```env
    # .env
    DB_TYPE=postgres
    DB_HOST=localhost
    DB_PORT=5432
    DB_NAME=wishlist
    DB_USER=postgres
    DB_PASSWORD=your_db_password
    ```

### Running the Application

- **Run the development server (with SQLite):**
  The server will automatically restart when you make changes to the code.

  ```bash
  npm run dev
  ```

- **Run with PostgreSQL:**
  ```bash
  npm run dev:pg
  ```

The application will be available at `http://localhost:3000`.

### Running Tests

- **Run all tests:**

  ```bash
  npm test
  ```

- **Run tests in watch mode:**

  ```bash
  npm run test:watch
  ```

- **Generate a test coverage report:**
  ```bash
  npm run test:coverage
  ```

## Deployment to Heroku

This application is configured for easy deployment to Heroku.

1.  **Login to the Heroku CLI:**

    ```bash
    heroku login
    ```

2.  **Create a Heroku application:**

    ```bash
    heroku create your-app-name
    ```

3.  **Add the Heroku Postgres addon:**

    ```bash
    heroku addons:create heroku-postgresql:essential-0 -a your-app-name
    ```

    This will automatically set the `DATABASE_URL` environment variable.

4.  **Push your code to Heroku:**

    ```bash
    git push heroku main
    ```

    The `heroku-postbuild` script in `package.json` will automatically build the TypeScript code.

5.  **Open your application:**
    ```bash
    heroku open
    ```

---

## The Story of Tanabata and Tanzaku

This project is inspired by **Tanabata** (七夕), one of Japan's most beautiful and romantic festivals, often called the "Star Festival." It celebrates the annual meeting of two lovers separated by the vast expanse of the night sky.

### The Legend of Orihime and Hikoboshi

The story originates from an ancient Chinese legend about two celestial deities. **Orihime** (織姫, the Weaver Princess) was a gifted weaver who wove beautiful clothes for the gods by the heavenly river, the **Amanogawa** (天の川, the Milky Way). Saddened that her constant work kept her from finding love, her father, the Sky King, arranged for her to meet **Hikoboshi** (彦星, the Cowherd Star), who lived on the other side of the river.

They fell instantly in love and were so devoted to each other that they began to neglect their duties. Orihime stopped weaving, and Hikoboshi's cows wandered across the heavens. Angered, the Sky King separated the lovers, placing them on opposite sides of the Amanogawa, forbidding them to meet.

Orihime was heartbroken. Moved by his daughter's tears, the Sky King allowed them to meet for just one night each year—on the **7th day of the 7th month**. It is said that on this night, a flock of magpies forms a bridge across the Milky Way, allowing Orihime to cross and reunite with her beloved Hikoboshi.

### What are Tanzaku?

On Tanabata, people celebrate by writing their wishes on small, colorful strips of paper called **tanzaku** (短冊). These wishes, often written in the form of poetry, are then hung on bamboo branches, creating beautiful, wish-laden trees. It is believed that the wishes will be carried to the heavens, and with the lovers' reunion, they might just come true.

This **Tanabata Wish Board** is a digital tribute to that tradition, creating a space for people everywhere to share their _tanzaku_ and celebrate the timeless themes of love, hope, and perseverance.
