import fs from "fs"
import csv from "csv-parser"

const geojson = {
    type: "FeatureCollection",
    features: []
}

console.log("Starting the conversion...")

const parseFile = (filename, defaultStatus) => {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filename)) {
            console.log(`File ${filename} not found, skipping...`)
            resolve()
            return
        }

        fs.createReadStream(filename)
            .pipe(csv())
            .on("data", (row) => {
                if (row.Longitude && row.Latitude) {
                    let finalStatus = row["Status"] ? row["Status"].trim() : defaultStatus

                    geojson.features.push({
                        type: "Feature",
                        geometry: {
                            type: "Point",
                            coordinates: [
                                parseFloat(row.Longitude.replace(',', '.')),
                                parseFloat(row.Latitude.replace(',', '.'))
                            ]
                        },
                        properties: {
                            name: row["Mine Name"],
                            openingYear: parseInt(row["Opening Year"]) || null,
                            closingYear: parseInt(row["Closing Year"]) || null,
                            country: row["Country / Area"],
                            status: finalStatus,
                            production: row["Production (Mtpa)"],
                            company: row["Parent Company"]
                        }
                    })
                }
            })
            .on("end", () => {
                console.log(`Finished reading ${filename}.`)
                resolve()
            })
            .on("error", reject)
    })
}

const run = async () => {
    try {
        await parseFile("non_closed_mines.csv", "Unknown")
        await parseFile("closed_mines.csv", "Closed")

        fs.writeFileSync("./public/mines.geojson", JSON.stringify(geojson))
        console.log(`Converted successfully! Total points found: ${geojson.features.length}`)
    } catch (err) {
        console.error("Error during conversion:", err)
    }
}

run()