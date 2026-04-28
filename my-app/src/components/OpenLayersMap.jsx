import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import { fromLonLat } from "ol/proj";

const INITIAL_CENTER = fromLonLat([11.582, 48.1351]);
const INITIAL_ZOOM = 11;

const OpenLayersMap = forwardRef(function OpenLayersMap(_, ref) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const viewRef = useRef(null);

    useEffect(() => {
        viewRef.current = new View({
            center: INITIAL_CENTER,
            zoom: INITIAL_ZOOM,
        });

        const map = new Map({
            target: mapRef.current,
            layers: [
                new TileLayer({
                    source: new OSM(),
                }),
            ],
            view: viewRef.current,
        });
        mapInstanceRef.current = map;

        return () => {
            map.setTarget(undefined);
            mapInstanceRef.current = null;
            viewRef.current = null;
        };
    }, []);

    useImperativeHandle(ref, () => ({
        zoomIn() {
            const view = viewRef.current;
            if (!view) return;
            view.setZoom((view.getZoom() || INITIAL_ZOOM) + 1);
        },
        zoomOut() {
            const view = viewRef.current;
            if (!view) return;
            view.setZoom((view.getZoom() || INITIAL_ZOOM) - 1);
        },
        resetView() {
            const view = viewRef.current;
            if (!view) return;
            view.setCenter(INITIAL_CENTER);
            view.setZoom(INITIAL_ZOOM);
        },
    }), []);

    return <div className="ol-map" ref={mapRef} />;
});

export default OpenLayersMap;