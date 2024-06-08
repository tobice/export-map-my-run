import log from "@apify/log";
import { mkdir } from "node:fs/promises";
import * as path from "node:path";
import * as fs from "node:fs";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import {
    WORKOUTS_DOWNLOAD_DIR,
    WORKOUTS_FETCH_LIMIT,
    WORKOUTS_STARTED_AFTER,
    WORKOUTS_STARTED_BEFORE,
    MAP_MY_RUN_COOKIES,
    MAP_MY_RUN_USER
} from "./config.js";

// Create download directory if it doesn't exist.
if (!fs.existsSync(WORKOUTS_DOWNLOAD_DIR)) {
    await mkdir(WORKOUTS_DOWNLOAD_DIR);
    log.info("Created download directory", { WORKOUTS_DOWNLOAD_DIR });
} else {
    log.info("Download directory already exists", { WORKOUTS_DOWNLOAD_DIR });
}

// Fetch the list of workouts from MapMyRun.
log.info("Fetching workouts from MapMyRun", { WORKOUTS_STARTED_AFTER, WORKOUTS_STARTED_BEFORE, WORKOUTS_FETCH_LIMIT });
const workouts = await fetchWorkouts(WORKOUTS_STARTED_AFTER, WORKOUTS_STARTED_BEFORE, WORKOUTS_FETCH_LIMIT);
log.info("Fetched workouts from MapMyRun", { count: workouts.length });

// Filter workouts that have GPS data.
const gpsWorkouts = workouts
    .filter(workout => workout._links.route?.length) // Presumably only workouts with route have GPS data
    .map(workout => ({
        id: workout._links.self[0].id,
        name: workout.name,
        startDatetime: workout.start_datetime,
    }));

log.info("Found (presumably) GPS workouts. Starting downloads ", { count: gpsWorkouts.length });

// Download TCX files.
let i = 0;
for (const workout of gpsWorkouts) {
    log.info("Downloading workout", { progress: `${++i}/${gpsWorkouts.length}`,  workout });
    await downloadWorkoutTcx(workout);
}

log.info("All workouts downloaded", { count: gpsWorkouts.length });

async function fetchWorkouts(startedAfter, startedBefore, limit) {
    const url = `https://www.mapmyrun.com/internal/allWorkouts/?user=${MAP_MY_RUN_USER}&started_after=${startedAfter.toISOString()}&started_before=${startedBefore.toISOString()}&limit=${limit}`;
    const response = await fetch(url, getMapMyRunRequestOptions());

    if (!response.ok) {
        await logNotOk(response);
        throw new Error("Fetching failed");
    }

    log.info("Request succeeded", { url });

    return await response.json();
}

async function downloadWorkoutTcx({ id, startDatetime }) {
    const targetFilename = `workout-${startDatetime}-${id}.tcx`;
    const targetPath = path.resolve(`./${WORKOUTS_DOWNLOAD_DIR}/`, targetFilename);

    // Check if the file already exists, in which case we skip it.
    if (fs.existsSync(targetPath)) {
        const stats = fs.statSync(targetPath);
        if (stats.size > 0) { // We don't count empty files
            log.info("Workout already downloaded, skipping", { targetFilename });
            return;
        }
    }

    const response = await fetch(`https://www.mapmyrun.com/workout/export/${id}/tcx`, getMapMyRunRequestOptions());

    if (!response.ok) {
        await logNotOk(response);
        throw new Error("Download request has failed");
    }

    const fileStream = fs.createWriteStream(targetPath, { flags: 'w' }); // 'w' overrides an existing file
    await finished(Readable.fromWeb(response.body).pipe(fileStream));

    log.info("Workout downloaded", { targetFilename });
}

function getMapMyRunRequestOptions() {
    return {
        credentials: "include",
        headers: {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.5",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "Cookie": MAP_MY_RUN_COOKIES,
        },
        referrer: "https://www.mapmyrun.com/dashboard",
        method: "GET",
        mode: "cors"
    }
}

async function logNotOk(response) {
    let errorDetails;
    try {
        errorDetails = await response.json();
    } catch (jsonError) {
        // If response is not JSON, fallback to text
        errorDetails = await response.text();
    }

    log.error("Request failed", {
        status: response.status,
        statusText: response.statusText,
        errorDetails,
    });
}
