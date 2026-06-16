import { useEffect, useMemo, useRef, useState } from "react"
import Map, { Source, Layer } from "react-map-gl/maplibre"
import type { LayerProps, MapRef } from "react-map-gl/maplibre"
import { Card, CardHeader, CardTitle, CardContent } from "./components/ui/card"
import { Slider } from "./components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import "maplibre-gl/dist/maplibre-gl.css"

const STATUS_COLORS: Record<string, string> = {
    "Operating": "#ef4444",
    "Proposed": "#3b82f6",
    "Cancelled": "#22c55e",
    "Shelved": "#4b5563",
    "Mothballed": "#9ca3af",
    "Closed": "#f97316"
}

const STATUSES = Object.keys(STATUS_COLORS)

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
}

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
        "circle-color": [
            "match",
            ["get", "status"],
            "Operating", STATUS_COLORS["Operating"],
            "Proposed", STATUS_COLORS["Proposed"],
            "Cancelled", STATUS_COLORS["Cancelled"],
            "Shelved", STATUS_COLORS["Shelved"],
            "Mothballed", STATUS_COLORS["Mothballed"],
            "Closed", STATUS_COLORS["Closed"],
            "#007cbf"
        ],
        "circle-opacity": 0.8,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff"
    }
}

const unclusteredLabelLayer: LayerProps = {
    id: "unclustered-label",
    type: "symbol",
    filter: ["!", ["has", "point_count"]],
    minzoom: 6,
    layout: {
        "text-field": ["get", "yearLabel"],
        "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
        "text-size": 12,
        "text-offset": [0, 1.2],
        "text-anchor": "top"
    },
    paint: {
        "text-color": "#ffffff",
        "text-halo-color": "#000000",
        "text-halo-width": 1.5
    }
}

const surfaceClasses = "rounded-lg shadow-lg bg-background/80 backdrop-blur-md"

export default function App() {
    const mapRef = useRef<MapRef>(null)

    const [isClustering, setIsClustering] = useState(true)
    const [openingYearRange, setOpeningYearRange] = useState([0, 2026])
    const [closingYearRange, setClosingYearRange] = useState([0, 2026])

    const [minOpeningYear, setMinOpeningYear] = useState(2026)

    const [filterMode, setFilterMode] = useState<"opening" | "closing">("opening")

    const [activeStatuses, setActiveStatuses] = useState<string[]>(STATUSES)

    const [selectedMine, setSelectedMine] = useState<any>(null)
    const [cursor, setCursor] = useState("")

    const [geoData, setGeoData] = useState<any>({
        type: "FeatureCollection",
        features: []
    })

    const filteredData = useMemo(() => {
        const filteredFeatures = geoData.features.filter((item: any) => {
            const openingYear = item.properties?.openingYear
            const closingYear = item.properties?.closingYear
            const status = item.properties?.status

            if (status && !activeStatuses.includes(status)) return false

            if (filterMode === "opening") {
                if (!openingYear) return false
                return openingYear >= openingYearRange[0] && openingYear <= openingYearRange[1]
            } else {
                if (!closingYear) return false
                return closingYear >= closingYearRange[0] && closingYear <= closingYearRange[1]
            }
        })

        return {
            type: "FeatureCollection" as const,
            features: filteredFeatures.map((item: any) => ({
                ...item,
                properties: {
                    ...item.properties,
                    yearLabel: item.properties.closingYear
                        ? `${item.properties.openingYear} - ${item.properties.closingYear}`
                        : `${item.properties.openingYear}`
                }
            }))
        }
    }, [geoData, openingYearRange, closingYearRange, activeStatuses, filterMode])

    useEffect(() => {
        fetch(`${import.meta.env.BASE_URL}/mines.geojson`)
            .then(res => res.json())
            .then(data => {
                let lowestOpeningYear = 2026

                for (let item of data.features) {
                    const openingYear = item.properties?.openingYear
                    if (openingYear) {
                        if (openingYear < lowestOpeningYear) lowestOpeningYear = openingYear
                    }
                }

                setMinOpeningYear(lowestOpeningYear)
                setOpeningYearRange([lowestOpeningYear, 2026])

                setClosingYearRange([1900, 2026])

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
                    <Layer {...unclusteredLabelLayer} />
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
                        <div className="space-y-2 pt-2 border-border/50">
                            <h4 className="text-sm font-semibold mb-3">Mine Status</h4>
                            {STATUSES.map(status => (
                                <div key={status} className="flex items-center space-x-3">
                                    <Checkbox
                                        id={`status-${status}`}
                                        checked={activeStatuses.includes(status)}
                                        onCheckedChange={(checked) => {
                                            setActiveStatuses(prev =>
                                                checked
                                                    ? [...prev, status]
                                                    : prev.filter(s => s !== status)
                                            )
                                        }}
                                    />
                                    <div
                                        className="w-3 h-3 rounded-full shadow-sm"
                                        style={{ backgroundColor: STATUS_COLORS[status] }}
                                    />
                                    <label htmlFor={`status-${status}`} className="text-sm cursor-pointer select-none">
                                        {status}
                                    </label>
                                </div>
                            ))}
                            <p>{filteredData.features.length} selected</p>
                        </div>
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

            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[70%] z-10">
                <Card className={`${surfaceClasses} p-6`}>
                    <div className="flex justify-center space-x-8 mb-6">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="radio"
                                name="filterMode"
                                value="opening"
                                checked={filterMode === "opening"}
                                onChange={() => setFilterMode("opening")}
                                className="w-4 h-4 accent-primary"
                            />
                            <span className="text-sm font-semibold">Filter by Opening Year</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="radio"
                                name="filterMode"
                                value="closing"
                                checked={filterMode === "closing"}
                                onChange={() => setFilterMode("closing")}
                                className="w-4 h-4 accent-primary"
                            />
                            <span className="text-sm font-semibold">Filter by Closing Year</span>
                        </label>
                    </div>
                    {filterMode === "opening" ? (
                        <>
                            <div className="mb-4 text-center font-semibold tracking-wide text-sm text-muted-foreground">
                                Mines opened from <span className="text-foreground">{openingYearRange[0]}</span> to <span className="text-foreground">{openingYearRange[1]}</span>
                            </div>
                            <Slider
                                value={openingYearRange}
                                onValueChange={value => setOpeningYearRange(value)}
                                max={2026}
                                min={minOpeningYear}
                                step={1}
                            />
                        </>
                    ) : (
                        <>
                            <div className="mb-4 text-center font-semibold tracking-wide text-sm text-muted-foreground">
                                Mines closed from <span className="text-foreground">{closingYearRange[0]}</span> to <span className="text-foreground">{closingYearRange[1]}</span>
                            </div>
                            <Slider
                                value={closingYearRange}
                                onValueChange={value => setClosingYearRange(value)}
                                max={2026}
                                min={1900}
                                step={1}
                            />
                        </>
                    )}
                </Card>
            </div>
        </div >
    )
}