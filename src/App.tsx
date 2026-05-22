import { useEffect, useMemo, useRef, useState } from "react"
import Map, { Source, Layer } from "react-map-gl/maplibre"
import type { LayerProps, MapRef } from 'react-map-gl/maplibre'
import { Card, CardHeader, CardTitle, CardContent } from "./components/ui/card"
import { Slider } from "./components/ui/slider"
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
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
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

    const [currentYear, setCurrentYear] = useState(2026)
    const [minYear, setMinYear] = useState(2026)
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
                const year = item.properties?.year
                return year && year <= currentYear
            })
        }
    }, [geoData, currentYear])

    useEffect(() => {
        fetch(`${import.meta.env.BASE_URL}/mines.geojson`)
            .then(res => res.json())
            .then(data => {
                let lowestYear = 2026
                for (let item of data.features) {
                    const year = item.properties?.year
                    if (year && year < lowestYear) {
                        lowestYear = year
                    }
                }
                setMinYear(lowestYear)
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
                    id="my-data"
                    type="geojson"
                    data={filteredData}
                    cluster={true}
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
                        <p><span className="font-semibold text-muted-foreground">Opened:</span> {selectedMine?.year || "Unknown"}</p>
                        <p><span className="font-semibold text-muted-foreground">Country:</span> {selectedMine?.country || "Unknown"}</p>
                        <p><span className="font-semibold text-muted-foreground">Status:</span> {selectedMine?.status || "Unknown"}</p>
                        <p><span className="font-semibold text-muted-foreground">Production:</span> {selectedMine?.production ? `${selectedMine.production} Mtpa` : "Unknown"}</p>
                        <p><span className="font-semibold text-muted-foreground">Parent Company:</span> {selectedMine?.company || "Unknown"}</p>
                    </CardContent>
                </Card>
            </div>

            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[70%] z-10">
                <Card className={`${surfaceClasses} p-6`}>
                    <div className="mb-4 text-center font-semibold tracking-wide text-sm">
                        Filtered by year: {currentYear}
                    </div>
                    <Slider
                        value={[currentYear]}
                        onValueChange={value => setCurrentYear(value[0])}
                        max={2026}
                        min={minYear}
                        step={1}
                    />
                </Card>
            </div>
        </div >
    )
}