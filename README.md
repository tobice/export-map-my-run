# Export TCX GPS files from MapMyRun

How to use:

1. Install `node` and run `npm install`.
2. Create a `config.js` file and populate it:
   ```javascript
   export const WORKOUTS_STARTED_AFTER = new Date("2010-04-30T00:00:00.000Z");
   export const WORKOUTS_STARTED_BEFORE = new Date("2024-05-31T00:00:00.000Z");
   export const WORKOUTS_FETCH_LIMIT = 1000;
   export const WORKOUTS_DOWNLOAD_DIR = "./workouts";
   export const MAP_MY_RUN_USER = "...";
   export const MAP_MY_RUN_COOKIES = "<key>=<value>; auth-token=<token>; ...";
   ```
   You can use browser developer tools to find your user ID and cookies after you sign in to your MapMyRun account.
3. Configure the date range in `export-map-my-run.js`.
4. Start the export with `npm run start`.
