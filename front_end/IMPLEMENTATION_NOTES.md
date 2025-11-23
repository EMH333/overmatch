# Overmatch Implementation Notes

## Overview

This application has been refactored from a TIGER lane/surface validation tool to an Overture-to-OSM data matching and tagging tool. The workflow allows users to review matched OSM restaurants/amenities with their corresponding Overture data and apply relevant tags.

## Core Workflow

The application follows this flow:

1. **User selects a geographic area** via relation autocomplete
2. **Fetch OSM elements** from Overpass API (restaurants, bars, cafes, fast food, pubs)
3. **Filter by matches** using the `/matches` API endpoint to get only elements with Overture matches
4. **Apply deduplication logic**: `(OSM_objects_via_Overpass - OSM_not_matched_on_server - (OSM_already_uploaded + Overture_skipped))`
5. **Fetch live OSM data** for each element from the OSM API
6. **Display comparison table** showing OSM tags vs Overture tags
7. **User actions**:
   - Apply Overture tags to OSM element (adds to upload queue)
   - Skip match (marks Overture ID as "not matching")
   - Move to next element
8. **Upload changes** in batch via UploadModal
9. **Post-upload sync**: POST to `/osm` with uploaded OSM IDs and `/overture` with skipped Overture IDs

## New Files Created

### Services

- **`services/matchingApi.ts`**: API client for the matching/tracking endpoints
  - `getMatches(osmIds)`: Check which OSM elements have Overture matches
  - `postOsmElements(osmIds)`: Mark OSM elements as processed
  - `postOvertureElements(overtureIds)`: Mark Overture elements as skipped/not matching

### Types

- **`types/matching.ts`**: TypeScript interfaces for API responses
  - `MatchInfo`: Details about a single OSM-Overture match
  - `MatchStatus`: Match status for an OSM element (can have multiple matches)
  - `MatchesResponse`: Response from `/matches` endpoint

### Components

- **`components/TagComparisonTable.tsx`**: Main comparison UI
  - Displays OSM tags vs Overture tags in a table
  - Supports multiple Overture matches per OSM element (radio button selection)
  - Color-coded differences (same/different/OSM-only/Overture-only)
  - Shows match metadata (distance, similarity score)
  - Actions: Apply tags or skip match

### Utilities

- **`utils/osmHelpers.ts`**: Helper functions
  - `formatOsmId()`: Convert OsmElement to "type/id" string format
  - `parseOsmId()`: Parse "type/id" string
  - `shuffleArray()`: Randomize element order
  - `getElementCoordinates()`: Extract lat/lon from various OSM element types

## Modified Files

### Core Components

**`App.tsx`**

- Removed old TIGER-specific logic (bbox, ZXY tiles, etc.)
- Implemented new workflow: fetch → filter by matches → display
- Added URL parameter parsing for relation ID
- Integrated match filtering logic with deduplication
- Coordinates extraction for map display

**`components/LeftPane.tsx`**

- Replaced generic element editor with TagComparisonTable
- Added live OSM tag fetching on element change
- Handles tag application (adds to upload queue)
- Handles match skipping (marks Overture ID)
- Shows element metadata card

**`components/modals/UploadModal.tsx`**

- Added posting to `/osm` and `/overture` endpoints after successful upload
- Posts both uploaded OSM IDs and skipped Overture IDs
- Shows tracking database update status

### Data Management

**`stores/useElementStore.ts`**

- Added `skippedOvertureIds`: Track which Overture matches user rejected
- Added `elementMatches`: Map of OSM ID → MatchInfo[] for quick lookup
- Added `addSkippedOvertureId()`: Mark Overture ID as skipped
- Added `setElementMatches()`: Store match data for an element
- Updated persistence to save skipped IDs

**`objects.ts`**

- Added optional `lat`/`lon` to OsmElement base interface
- Added `OvertureMatch` interface (deprecated in favor of types/matching.ts)

### Generic Component Updates

**`components/ElementAccordion.tsx`** (formerly WayAccordion)

- Changed from `OsmWay[]` to `OsmElement[]` for flexibility
- Updated to show amenity type instead of highway
- Graceful handling of missing tags

**`components/ElementAccordionItemContent.tsx`**

- Updated interface to accept `OsmElement` instead of `OsmWay`

**`components/Navbar.tsx`**

- Updated to use `OsmElement[]` instead of `OsmWay[]`

**`components/UploadButton.tsx`**

- Updated to use `OsmElement[]` instead of `OsmWay[]`
- Fixed async handling for `setChangeset` callback
- Added external loading state support

## API Configuration

The matching API base URL is currently hardcoded in `services/matchingApi.ts`:

```typescript
const API_BASE_URL = "http://localhost:8000";
```

**TODO**: Move to environment variable (e.g., `VITE_API_BASE_URL`)

## API Endpoints Used

### Matching/Tracking API

- **GET `/matches?osm_ids=way/123,node/456`**
  - Returns match status and Overture match details for OSM elements
  - Used to filter which elements to show the user

- **POST `/osm`** with `{ ids: ["way/123", "node/456"] }`
  - Marks OSM elements as processed/uploaded
  - Called after successful changeset upload

- **POST `/overture`** with `{ ids: ["overture_id_1", "overture_id_2"] }`
  - Marks Overture elements as skipped/not matching
  - Called after successful changeset upload

### OpenStreetMap API

- **GET `/api/0.6/[node|way|relation]/#id.json`**
  - Fetches live/current version of OSM element
  - Used to ensure tag comparison uses latest data

### Overpass API

- **POST `/api/interpreter`**
  - Queries OSM data by relation, bbox, or specific IDs
  - Configured in `services/overpass.ts` to query restaurants, bars, cafes, fast food, pubs

## Data Flow

```
┌─────────────────┐
│ User selects    │
│ relation        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Overpass API    │──────► Fetch all restaurants/amenities
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Matching API    │──────► Filter by matches
│ /matches        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Deduplication   │──────► Remove uploaded/skipped
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ For each elem:  │
│ OSM API fetch   │──────► Get live tags
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Display         │
│ TagComparison   │◄─────┐
│ Table           │      │
└────────┬────────┘      │
         │               │
         ├─ Apply Tags ──┤
         │   (to upload) │
         │               │
         └─ Skip Match ──┤
             (mark ID)   │
                         │
         ┌───────────────┘
         │
         ▼
┌─────────────────┐
│ Upload changes  │
│ to OSM          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ POST to         │
│ /osm & /overture│──────► Sync tracking DB
└─────────────────┘
```

## Multi-Match Handling

When an OSM element has multiple Overture matches:

- All matches are shown in a radio button group
- User selects which match to compare against
- Tag comparison table shows all matches in separate columns (if >1 match)
- When applying tags, only the selected match's tags are used
- When skipping, only the selected match is marked as skipped (user can still see other matches on next review)

## Known Issues / TODOs

1. **Type inconsistencies**: Some places still use `as any` casts (e.g., `uploadChanges` function)
2. **API URL**: Should be moved to environment variable
3. **Error handling**: Could be more robust for network failures
4. **Upload service**: `services/upload.ts` needs updating to handle generic `OsmElement` instead of just `OsmWay`
5. **TypeScript strict mode**: Some utility functions use loose typing (e.g., accessing `element.geometry`)
6. **Missing hooks**: `useWayManagement` was removed but may have useful functionality
7. **Persistence**: Map state (zoom, center) not persisted between sessions
8. **Overpass cache**: No caching of Overpass results, re-fetches on every relation select

## Testing Recommendations

1. Test with relation that has:
   - Elements with single Overture match
   - Elements with multiple Overture matches
   - Elements with no matches
   - Mix of nodes, ways, and relations

2. Test upload workflow:
   - Apply some tags
   - Skip some matches
   - Verify POST requests to /osm and /overture
   - Verify uploaded elements don't reappear

3. Test error cases:
   - OSM API rate limiting
   - Matching API unavailable
   - Overpass timeout
   - Invalid relation ID

## State Management

### Zustand Stores

**`useElementStore`** (persisted)

- `overpassElements`: Current batch of elements from Overpass
- `currentElement`: Index of element being viewed
- `uploadElements`: Queue of elements to upload (with updated tags)
- `skippedOvertureIds`: List of Overture IDs user marked as not matching
- `elementMatches`: Map of OSM ID → array of MatchInfo

**`useChangesetStore`**

- `relation`: Selected relation {id, name}
- `host`: Application URL
- `description`: Changeset description
- `databaseVersion`: OSM database version for changeset tags

### Component State

- `App.tsx`: Loading states, modals, error messages
- `LeftPane.tsx`: Live OSM tags, loading state, errors
- `TagComparisonTable.tsx`: Selected match index (when multiple matches)

## Dependencies

Key libraries used:

- **React**: UI framework
- **Zustand**: State management (with persistence)
- **@heroui/\***: UI component library
- **MapLibre GL**: Map rendering
- **osm-auth**: OAuth authentication for OSM API
