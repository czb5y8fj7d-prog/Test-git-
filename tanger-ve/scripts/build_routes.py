#!/usr/bin/env python3
"""Calcule de vrais itinéraires routiers (OSM) avec altitudes (SRTM) et écrit des GPX.

Usage : python scripts/build_routes.py <extraction.osm.pbf> <N35W006.hgt>
Dépendances : pip install pyrosm networkx numpy scipy

ATTENTION : script écrit sans accès aux données, non testé sur de vraies données.
"""
import json
import math
import os
import sys

import networkx as nx
import numpy as np
from pyrosm import OSM
from scipy.spatial import cKDTree

ROUTES = [
    ("corniche-port", "Corniche → Port", [(35.7870, -5.7790), (35.7850, -5.7950), (35.7895, -5.8090)]),
    ("centre-aeroport", "Centre → Aéroport", [(35.7868, -5.8135), (35.7770, -5.8180), (35.7570, -5.8600), (35.7380, -5.8980), (35.7269, -5.9169)]),
    ("medina-kasbah-hafa", "Médina–Kasbah–Hafa", [(35.7895, -5.8090), (35.7880, -5.8110), (35.7913, -5.8143), (35.7898, -5.8180), (35.7886, -5.8245)]),
    ("corniche-cap-malabata", "Corniche → Cap Malabata", [(35.7870, -5.7790), (35.7960, -5.7640), (35.8070, -5.7440)]),
    ("centre-cap-spartel", "Centre → Cap Spartel", [(35.7868, -5.8135), (35.7898, -5.8180), (35.7860, -5.8350), (35.7900, -5.8750), (35.7930, -5.9050), (35.7920, -5.9220)]),
    ("tanger-chefchaouen", "Tanger → Chefchaouen", [(35.7868, -5.8135), (35.5785, -5.3684), (35.1688, -5.2636)]),
]
STEP_M = 25.0  # pas de rééchantillonnage


def load_hgt(path):
    n = int(math.isqrt(os.path.getsize(path) // 2))
    name = os.path.basename(path).upper()
    lat0 = int(name[1:3]) * (1 if name[0] == "N" else -1)
    lon0 = int(name[4:7]) * (1 if name[3] == "E" else -1)
    a = np.fromfile(path, dtype=">i2").reshape(n, n).astype(float)
    a[a == -32768] = np.nan
    return a, lat0, lon0, n


def elevation(dem, lat, lon):
    a, lat0, lon0, n = dem
    r = (lat0 + 1 - lat) * (n - 1)
    c = (lon - lon0) * (n - 1)
    r0, c0 = np.clip(np.floor(r).astype(int), 0, n - 2), np.clip(np.floor(c).astype(int), 0, n - 2)
    fr, fc = r - r0, c - c0
    return (a[r0, c0] * (1 - fr) * (1 - fc) + a[r0 + 1, c0] * fr * (1 - fc)
            + a[r0, c0 + 1] * (1 - fr) * fc + a[r0 + 1, c0 + 1] * fr * fc)


def hav_m(lat1, lon1, lat2, lon2):
    p = math.pi / 180
    x = math.sin((lat2 - lat1) * p / 2) ** 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lon2 - lon1) * p / 2) ** 2
    return 12742000 * math.asin(math.sqrt(x))


def edge_coords(G, u, v, nodes_xy):
    data = min(G[u][v].values(), key=lambda d: d.get("length", 0))
    g = data.get("geometry")
    if g is None:
        return [nodes_xy[u], nodes_xy[v]]
    pts = list(g.coords)
    ux, uy = nodes_xy[u]
    if math.hypot(pts[0][0] - ux, pts[0][1] - uy) > math.hypot(pts[-1][0] - ux, pts[-1][1] - uy):
        pts.reverse()
    return pts


def densify(coords):
    out = [coords[0]]
    for (x1, y1), (x2, y2) in zip(coords, coords[1:]):
        d = hav_m(y1, x1, y2, x2)
        k = max(1, int(d // STEP_M))
        for i in range(1, k + 1):
            t = i / k
            out.append((x1 + (x2 - x1) * t, y1 + (y2 - y1) * t))
    return out


def write_gpx(path, name, pts, ele):
    with open(path, "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="tanger-ve" xmlns="http://www.topografix.com/GPX/1/1">\n')
        f.write(f"<trk><name>{name}</name><trkseg>\n")
        for (x, y), e in zip(pts, ele):
            f.write(f'<trkpt lat="{y:.6f}" lon="{x:.6f}"><ele>{e:.1f}</ele></trkpt>\n')
        f.write("</trkseg></trk></gpx>\n")


def main(pbf, hgt):
    dem = load_hgt(hgt)
    osm = OSM(pbf)
    nodes, edges = osm.get_network(network_type="driving", nodes=True)
    G = osm.to_graph(nodes, edges, graph_type="networkx")
    ids = nodes["id"].to_numpy()
    xy = nodes[["lon", "lat"]].to_numpy()
    nodes_xy = {i: (x, y) for i, (x, y) in zip(ids, xy)}
    tree = cKDTree(xy)
    here = os.path.dirname(os.path.abspath(__file__))
    out_dir = os.path.join(here, "..", "routes")
    done = []
    for rid, name, wps in ROUTES:
        path_nodes = []
        for (la1, lo1), (la2, lo2) in zip(wps, wps[1:]):
            a = ids[tree.query([lo1, la1])[1]]
            b = ids[tree.query([lo2, la2])[1]]
            seg = nx.shortest_path(G, a, b, weight="length")
            path_nodes += seg if not path_nodes else seg[1:]
        coords = []
        for u, v in zip(path_nodes, path_nodes[1:]):
            coords += edge_coords(G, u, v, nodes_xy)
        pts = densify(coords)
        lons, lats = np.array([p[0] for p in pts]), np.array([p[1] for p in pts])
        ele = elevation(dem, lats, lons)
        bad = np.isnan(ele)
        if bad.all():
            print(f"{rid}: aucune altitude trouvée (dalle SRTM inadaptée ?)")
            continue
        if bad.any():
            ele[bad] = np.interp(np.flatnonzero(bad), np.flatnonzero(~bad), ele[~bad])
        write_gpx(os.path.join(out_dir, rid + ".gpx"), name, pts, ele)
        done.append(rid + ".gpx")
        print(f"{rid}: {len(pts)} points")
    with open(os.path.join(out_dir, "index.json"), "w", encoding="utf-8") as f:
        json.dump(done, f, ensure_ascii=False)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
