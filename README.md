# Coal Mine Tracker

An interactive, high-performance web mapping dashboard designed to visualize the distribution and operational history of coal mines worldwide. 

## Features

* **High-Performance Rendering:** Utilizes WebGL via MapLibre GL JS to smoothly render thousands of data points without browser lag.
* **Dynamic Clustering:** Implements zoom-based data clustering. Overlapping coordinates are aggregated dynamically, improving both UX and performance.
* **Interactive Time Filter:** A responsive slider allows users to filter the dataset by the mine's opening year in real-time.
* **Detailed Point Information:** Interactive UI cards smoothly transition into view when selecting individual mines, displaying key metrics (Name, Opening Year, Country, Status, etc.).
* **Dark Mode UI:** Sleek, modern interface built with `shadcn/ui` components and an optimized dark basemap.

## Tech Stack

* **Core:** React, TypeScript, Vite
* **Mapping:** MapLibre GL JS, `react-map-gl`
* **Styling:** Tailwind CSS, `shadcn/ui`
* **Data Processing:** Native Fetch API & GeoJSON parsing

## Getting Started

To run this project locally, follow these steps:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/1ways/coal-mine-tracker.git
2. **Install dependencies:**
   ```bash
   npm install
3. **Start the development server:**
   ```bash
   npm run dev
4. **Open http://localhost:5173 in your browser.**

## Data Source

The dataset used in this project is based on the Global Coal Mine Tracker provided by the Global Energy Monitor. The data was converted from .xlsx/.csv format into an optimized GeoJSON feature collection specifically for web mapping purposes.

Disclaimer: This project was built for educational and portfolio purposes. All data rights belong to their respective owners.