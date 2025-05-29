{
  "starting_village": {
    "id": "starting_village",
    "name": "Starting Village",
    "description": "A small, peaceful village, surrounded by dense forests. The air feels humid and you hear strange sounds in the distance. There's a path leading north.",
    "exits": {
      "north": "dense_forest"
    },
    "items": ["shining_stone", "wooden_stick"],
    "creatures": []
  },
  "dense_forest": {
    "id": "dense_forest",
    "name": "Dense Forest",
    "description": "Towering trees blot out the sky, creating a dark canopy. The paths here are winding and it's easy to get lost. You can see a path back to the south or further east.",
    "exits": {
      "south": "starting_village",
      "east": "ancient_cave"
    },
    "items": ["strange_mushroom", "herbal_leaf"],
    "creatures": ["nine_tailed_fox"]
  },
  "ancient_cave": {
    "id": "ancient_cave",
    "name": "Ancient Cave",
    "description": "A dark and damp cave, with ancient carvings on its walls telling forgotten tales. The air is cold and moist. There's a path back to the west.",
    "exits": {
      "west": "dense_forest"
    },
    "items": ["glowing_crystal"],
    "creatures": ["dragon"]
  }
}
