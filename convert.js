import fs from "fs"
import csv from "csv-parser"

const geojson = {
    type: "FeatureCollection",
    features: []
}

console.log("Starting the conversion...")

fs.createReadStream("mines.csv")
    .pipe(csv())
    .on("data", (row) => {
        if (row.Longitude && row.Latitude) {
            geojson.features.push({
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [parseFloat(row.Longitude), parseFloat(row.Latitude)]
                },
                properties: {
                    name: row["Mine Name"],
                    openingYear: parseInt(row["Opening Year"]) || null,
                    closingYear: parseInt(row["Closing Year"]) || null,
                    country: row["Country / Area"],
                    status: row["Status"],
                    production: row["Production (Mtpa)"],
                    company: row["Parent Company"]
                }
            })
        }
    })
    .on("end", () => {
        fs.writeFileSync("./public/mines.geojson", JSON.stringify(geojson))
        console.log(`Converted successfully! Points found: ${geojson.features.length}`)
    })
    .on("error", (err) => {
        console.error("Error while reading the file:", err)
    })