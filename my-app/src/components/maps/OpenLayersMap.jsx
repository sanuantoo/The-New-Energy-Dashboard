import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import { fromLonLat } from "ol/proj";
// Define the initial map center coordinates as Munich as an example. 
const INITIAL_CENTER = fromLonLat([11.582, 48.1351]);
//  default zoom level is fixed to 11.
const INITIAL_ZOOM = 11;

// Create a React component that forwards its ref to allow parent components to access custom control methods (zoom in, zoom out, reset view)
const OpenLayersMap = forwardRef(function OpenLayersMap(_, ref) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const viewRef = useRef(null);

    useEffect(() => {
        // Create a persistent View object with the initial center and zoom.
        viewRef.current = new View({
            center: INITIAL_CENTER,
            zoom: INITIAL_ZOOM,
        });

        // Create the OpenLayers map and attach it to the HTML container.
        const map = new Map({
            target: mapRef.current,
            layers: [
                // Add the default OpenStreetMap tile layer.
                new TileLayer({
                    source: new OSM(),
                }),
            ],
            view: viewRef.current,
        });
        // Store the map instance for future reference.
        mapInstanceRef.current = map;

        return () => {
            // Properly remove map target during unmount to avoid memory leaks.
            map.setTarget(undefined);
            // Clear stored references.
            mapInstanceRef.current = null;
            viewRef.current = null;
        };
    }, []);

    // Expose high-level map controls to the parent dashboard UI through the ref.
    useImperativeHandle(ref, () => ({
        // Increase the current zoom level by one.
        zoomIn() {
            const view = viewRef.current;
            if (!view) return;
            view.setZoom((view.getZoom() || INITIAL_ZOOM) + 1);
        },
        // Decrease the current zoom level by one.  
        zoomOut() {
            const view = viewRef.current;
            if (!view) return;
            view.setZoom((view.getZoom() || INITIAL_ZOOM) - 1);
        },
        // Restore the map to its original center and zoom level.
        resetView() {
            const view = viewRef.current;
            if (!view) return;
            view.setCenter(INITIAL_CENTER);
            view.setZoom(INITIAL_ZOOM);
        },
    }), []);
    // Render the container where the OpenLayers map will be displayed.
    return <div className="ol-map" ref={mapRef} />;
});
// Export the component so it can be used in other parts of the application.
export default OpenLayersMap;