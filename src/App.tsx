import { useEffect, useMemo, useRef, useState } from "react"
import Map, { Source, Layer } from "react-map-gl/maplibre"
import type { LayerProps, MapRef } from "react-map-gl/maplibre"
import { Card, CardHeader, CardTitle, CardContent } from "./components/ui/card"
import { Slider } from "./components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import "maplibre-gl/dist/maplibre-gl.css"

const rasterBasemap = {
    version: 8,
    sources: {
        "carto-dark": {
            type: "raster",
            tiles: [
                "https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png",
                "https://b.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png",
                "https://c.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png",
                "https://d.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png"
            ],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
        }
    },
    layers: [
        {
            id: "carto-dark-layer",
            type: "raster",
            source: "carto-dark",
            minzoom: 0,
            maxzoom: 22
        }
    ]
};

const clusterLayer: LayerProps = {
    id: "clusters",
    type: "circle",
    filter: ["has", "point_count"],
    paint: {
        "circle-color": ["step", ["get", "point_count"], "#51bbd6", 100, "#f1f075", 750, "#f28cb1"],
        "circle-radius": ["step", ["get", "point_count"], 20, 100, 30, 750, 40]
    }
}

const clusterCountLayer: LayerProps = {
    id: "cluster-count",
    type: "symbol",
    filter: ["has", "point_count"],
    layout: {
        "text-field": "{point_count_abbreviated}",
        "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
        "text-size": 12
    },
}

const unclusteredPointLayer: LayerProps = {
    id: "unclustered-point",
    type: "circle",
    filter: ["!", ["has", "point_count"]],
    paint: {
        "circle-radius": 8,
        "circle-color": "#007cbf",
        "circle-opacity": 0.6,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff"
    }
}

const surfaceClasses = "rounded-lg shadow-lg bg-background/80 backdrop-blur-md"

export default function App() {
    const mapRef = useRef<MapRef>(null)

    const [isClustering, setIsClustering] = useState(true)
    const [openingYearRange, setOpeningYearRange] = useState([0, 2026])
    const [closingYearRange, setClosingYearRange] = useState([0, 2026])

    const [minOpeningYear, setMinOpeningYear] = useState(2026)
    const [maxOpeningYear, setMaxOpeningYear] = useState(2026)

    const [maxClosingYear, setMaxClosingYear] = useState(2026)

    const [selectedMine, setSelectedMine] = useState<any>(null)
    const [cursor, setCursor] = useState("")

    const [geoData, setGeoData] = useState<any>({
        type: "FeatureCollection",
        features: []
    })

    const filteredData = useMemo(() => {
        return {
            type: "FeatureCollection" as const,
            features: geoData.features.filter((item: any) => {
                const openingYear = item.properties?.openingYear
                const closingYear = item.properties?.closingYear

                if (!openingYear) return false

                const matchesOpening = openingYear >= openingYearRange[0] && openingYear <= openingYearRange[1]
                const matchesClosing = closingYear ? closingYear >= closingYearRange[0] && closingYear <= closingYearRange[1] : true

                return matchesOpening && matchesClosing
            })
        }
    }, [geoData, openingYearRange, closingYearRange])

    useEffect(() => {
        fetch(`${import.meta.env.BASE_URL}/mines.geojson`)
            .then(res => res.json())
            .then(data => {
                let lowestOpeningYear = 2026
                let highestOpeningYear = 2026

                let highestClosingYear = 2026

                for (let item of data.features) {
                    const openingYear = item.properties?.openingYear
                    if (openingYear) {
                        if (openingYear < lowestOpeningYear) lowestOpeningYear = openingYear
                        if (openingYear > highestOpeningYear) highestOpeningYear = openingYear
                    }

                    const closingYear = item.properties?.closingYear
                    if (closingYear && closingYear > highestClosingYear) {
                        if (closingYear > highestClosingYear) highestClosingYear = closingYear
                    }
                }

                setMinOpeningYear(lowestOpeningYear)
                setMaxOpeningYear(highestOpeningYear)
                setOpeningYearRange([lowestOpeningYear, highestOpeningYear])

                setMaxClosingYear(highestClosingYear)
                setClosingYearRange([1900, highestClosingYear])

                setGeoData(data)
            })
            .catch(err => console.error("Data loading error:", err))
    }, [])

    return (
        <div className="relative w-full h-screen overflow-hidden">
            <Map
                ref={mapRef}
                initialViewState={{
                    longitude: -122.4,
                    latitude: 37.8,
                    zoom: 3
                }}
                mapStyle={rasterBasemap as any}
                interactiveLayerIds={["clusters", "unclustered-point"]}
                cursor={cursor}
                onMouseEnter={() => setCursor("pointer")}
                onMouseLeave={() => setCursor("")}
                onClick={async (e) => {
                    if (e.features && e.features.length > 0) {
                        const feature = e.features[0]

                        if (feature.properties?.cluster) {
                            setSelectedMine(null)

                            const map = mapRef.current
                            if (!map) return

                            const clusterId = feature.properties.cluster_id
                            const source = map.getSource("my-data") as any

                            try {
                                const zoom = await source.getClusterExpansionZoom(clusterId)

                                map.flyTo({
                                    center: (feature.geometry as any).coordinates,
                                    zoom: zoom,
                                    duration: 1000
                                })
                            } catch (err) {
                                console.error("Cluster zoom error:", err)
                            }

                            return
                        }

                        setSelectedMine(feature.properties)
                    } else {
                        setSelectedMine(null)
                    }
                }}
            >
                <Source
                    key={String(isClustering)}
                    id="my-data"
                    type="geojson"
                    data={filteredData}
                    cluster={isClustering}
                    clusterMaxZoom={14}
                    clusterRadius={50}
                >
                    <Layer {...clusterLayer} />
                    <Layer {...clusterCountLayer} />
                    <Layer {...unclusteredPointLayer} />
                </Source>
            </Map>

            <div className="absolute top-6 left-6 z-10">
                <Card className={`${surfaceClasses} w-100`}>
                    <CardHeader>
                        <CardTitle>Global Coal Mine Tracker</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            {selectedMine ? "Click on an empty spot on the map to close the details." : "Select a mine on the map to view details."}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="absolute top-6 right-6 z-10">
                <Card className={`${surfaceClasses} w-50`}>
                    <CardHeader>
                        <CardTitle>Settings</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <FieldGroup className="mx-auto w-56">
                            <Field orientation="horizontal">
                                <Checkbox
                                    id="clustering-checkbox"
                                    name="clustering-checkbox"
                                    checked={isClustering}
                                    onCheckedChange={(value) => setIsClustering(!!value)}
                                />
                                <FieldLabel htmlFor="clustering-checkbox">
                                    {isClustering ? "Disable " : "Enable "} clustering
                                </FieldLabel>
                            </Field>
                        </FieldGroup>
                    </CardContent>
                </Card>
            </div>

            <div className={`absolute top-36 left-6 z-10 w-100 transition-all duration-300 ease-in-out ${selectedMine
                ? "translate-y-0 opacity-100 pointer-events-auto"
                : "translate-y-10 opacity-0 pointer-events-none"
                }`}>
                <Card className={surfaceClasses}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-bold text-primary">Mine Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <p><span className="font-semibold text-muted-foreground">Name:</span> {selectedMine?.name}</p>
                        <p><span className="font-semibold text-muted-foreground">Opened:</span> {selectedMine?.openingYear || "Unknown"}</p>
                        <p><span className="font-semibold text-muted-foreground">Closed:</span> {selectedMine?.closingYear || "Unknown"}</p>
                        <p><span className="font-semibold text-muted-foreground">Country:</span> {selectedMine?.country || "Unknown"}</p>
                        <p><span className="font-semibold text-muted-foreground">Status:</span> {selectedMine?.status || "Unknown"}</p>
                        <p><span className="font-semibold text-muted-foreground">Production:</span> {selectedMine?.production ? `${selectedMine.production} Mtpa` : "Unknown"}</p>
                        <p><span className="font-semibold text-muted-foreground">Parent Company:</span> {selectedMine?.company || "Unknown"}</p>
                    </CardContent>
                </Card>
            </div>

            <div className="absolute bottom-30 left-1/2 -translate-x-1/2 w-[70%] z-10">
                <Card className={`${surfaceClasses} p-4`}>
                    <div className="mb-4 text-center font-semibold tracking-wide text-sm">
                        Mines opened from {openingYearRange[0]} to {openingYearRange[1]}
                    </div>
                    <Slider
                        value={openingYearRange}
                        onValueChange={value => setOpeningYearRange(value)}
                        max={maxOpeningYear}
                        min={minOpeningYear}
                        step={1}
                    />
                </Card>
            </div>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[70%] z-10">
                <Card className={`${surfaceClasses} p-4`}>
                    <div className="mb-4 text-center font-semibold tracking-wide text-sm">
                        Mines closed from {closingYearRange[0]} to {closingYearRange[1]}
                    </div>
                    <Slider
                        value={closingYearRange}
                        onValueChange={value => setClosingYearRange(value)}
                        max={maxClosingYear}
                        min={1900}
                        step={1}
                    />
                </Card>
            </div>
        </div >
    )
}

export function CheckboxBasic() {
    return (
        <FieldGroup className="mx-auto w-56">
            <Field orientation="horizontal">
                <Checkbox id="terms-checkbox-basic" name="terms-checkbox-basic" />
                <FieldLabel htmlFor="terms-checkbox-basic">
                    Accept terms and conditions
                </FieldLabel>
            </Field>
        </FieldGroup>
    )
}
