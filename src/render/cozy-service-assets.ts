/** Additional service props redrawn from the approved cozy cafe style. */
export const COZY_SERVICE_ASSETS = {
  "cozy-grinder": "cozy-service-v2/cozy-grinder.png",
  "cozy-milk-pitcher": "cozy-service-v2/cozy-milk-pitcher.png",
  "cozy-cake-dome": "cozy-service-v2/cozy-cake-dome.png",
  "cozy-table-tent": "cozy-service-v2/cozy-table-tent.png"
} as const;

/** Pixel coordinates in each delivered PNG, including its transparent border. */
export const COZY_SERVICE_GUIDES = {
  "cozy-grinder": {
    "size": [
      127,
      192
    ],
    "artBounds": [
      9,
      9,
      109,
      174
    ],
    "foot": [
      63.5,
      183
    ],
    "aspect": 0.63
  },
  "cozy-milk-pitcher": {
    "size": [
      192,
      172
    ],
    "artBounds": [
      10,
      10,
      172,
      152
    ],
    "foot": [
      96,
      162
    ],
    "aspect": 1.13
  },
  "cozy-cake-dome": {
    "size": [
      191,
      192
    ],
    "artBounds": [
      9,
      9,
      173,
      174
    ],
    "foot": [
      95.5,
      183
    ],
    "aspect": 0.99,
    "interiorRect": [
      48.44,
      53.66,
      99.26,
      49.71
    ],
    "cakeFoot": [
      98.07,
      123.98
    ],
    "glassOverlayBottom": 104.47,
    "interiorTransparency": 0.91
  },
  "cozy-table-tent": {
    "size": [
      190,
      192
    ],
    "artBounds": [
      10,
      9,
      170,
      174
    ],
    "foot": [
      95,
      183
    ],
    "aspect": 0.98,
    "numberRect": [
      53.51,
      44.16,
      65.65,
      74.34
    ]
  }
} as const;
