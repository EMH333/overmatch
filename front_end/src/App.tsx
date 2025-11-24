import React, { useEffect, useState, useCallback, useMemo } from "react";
import Map from "./components/Map";
import Navbar from "./components/Navbar";

import "maplibre-gl/dist/maplibre-gl.css";
import LeftPane from "./components/LeftPane";
import ChangesetModal from "./components/modals/ChangesetModal";
import UploadModal from "./components/modals/UploadModal";
import AreaCompletedModal from "./components/modals/AreaCompletedModal";
import { overpassService } from "./services/overpass";
import ErrorModal from "./components/modals/ErrorModal";
import { useChangesetStore } from "./stores/useChangesetStore";
import { useElementStore } from "./stores/useElementStore";
import { useOsmAuthContext } from "./contexts/useOsmAuth";
import { matchingApi } from "./services/matchingApi";
import {
  formatOsmId,
  shuffleArray,
  getElementCoordinates,
} from "./utils/osmHelpers";
import { MatchStatus, MatchInfo } from "./types/matching";

const App: React.FC = () => {
  const [showRelationHeading, setShowRelationHeading] = useState(false);
  const [latestChangeset, setLatestChangeset] = useState<number>(0);
  const [showFinishedModal, setShowFinishedModal] = useState(false);
  const [isRelationLoading, setIsRelationLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [showAreaCompletedModal, setShowAreaCompletedModal] = useState(false);
  const { relation, setRelation, setHost, resetDescription } =
    useChangesetStore();

  const {
    overpassElements,
    currentElement,
    uploadElements,
    skippedOvertureIds,
    elementMatches,
    selectedMatchIndices,
    setOverpassElements,
    setCurrentElement,
    setUploadElements,
    setElementMatches,
  } = useElementStore();
  useOsmAuthContext();

  useEffect(() => {
    resetDescription();
  }, [resetDescription]);

  useEffect(() => {
    setHost(
      window.location.protocol +
        "//" +
        window.location.host +
        window.location.pathname,
    );
  }, [setHost]);

  // Parse URL parameters for relation
  const urlParams = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return {
      relation: searchParams.get("relation"),
    };
  }, []);

  // Fetch and filter elements when relation is selected
  useEffect(() => {
    const fetchAndFilterElements = async (relationId: string) => {
      if (!relationId || overpassElements.length > 0) return;

      setIsRelationLoading(true);
      setShowRelationHeading(true);

      try {
        // Step 1: Fetch all restaurant/amenity elements from Overpass
        const allElements =
          await overpassService.fetchIdsInRelation(relationId);

        if (allElements.length === 0) {
          setShowAreaCompletedModal(true);
          setIsRelationLoading(false);
          return;
        }

        // Step 2: Format OSM IDs and check which ones have matches
        const osmIds = allElements.map(formatOsmId);
        const matchesResponse = await matchingApi.getMatches(osmIds);

        // Step 3: Filter elements based on the equation:
        // (OSM_objects_via_Overpass - OSM_not_matched_on_server - (OSM_already_uploaded + Overture_skipped))

        // Create sets for efficient lookup
        const uploadedOsmIds = new Set(uploadElements.map(formatOsmId));

        // Filter matched elements
        const matchedElements = allElements.filter((element) => {
          const osmId = formatOsmId(element);
          const matchStatus = matchesResponse.elements.find(
            (m: MatchStatus) => m.osm_id === osmId,
          );

          // Keep if: has match, not uploaded, and no skipped Overture IDs in its matches
          if (!matchStatus || !matchStatus.has_match) return false;
          if (uploadedOsmIds.has(osmId)) return false;

          // Check if all matches have been skipped
          const allMatchesSkipped = matchStatus.matches.every(
            (match: MatchInfo) =>
              skippedOvertureIds.includes(match.overture_id),
          );
          if (allMatchesSkipped) return false;

          // Store match info for this element
          setElementMatches(osmId, matchStatus.matches);

          return true;
        });

        if (matchedElements.length === 0) {
          setShowAreaCompletedModal(true);
        } else {
          // Shuffle and set elements
          const shuffled = shuffleArray(matchedElements);
          setOverpassElements(shuffled);
          setCurrentElement(0);
        }
      } catch (error) {
        setError("Error fetching or filtering OSM data: " + error);
      } finally {
        setIsRelationLoading(false);
      }
    };

    if (urlParams.relation) {
      setRelation({ id: urlParams.relation });
      fetchAndFilterElements(urlParams.relation);
    }
  }, [
    urlParams.relation,
    overpassElements.length,
    uploadElements,
    skippedOvertureIds,
    setRelation,
    setOverpassElements,
    setCurrentElement,
    setElementMatches,
  ]);

  const handleNext = useCallback(() => {
    if (currentElement < overpassElements.length - 1) {
      setCurrentElement(currentElement + 1);
    } else {
      setShowFinishedModal(true);
    }
  }, [currentElement, overpassElements.length, setCurrentElement]);

  // Get coordinates for current element (OSM) and selected Overture match to show on map
  const mapCoordinates = useMemo((): [number, number][] => {
    if (overpassElements.length === 0 || !overpassElements[currentElement]) {
      return [];
    }

    const currentOsmElement = overpassElements[currentElement];
    const osmCoords = getElementCoordinates(currentOsmElement);

    if (!osmCoords) {
      console.log("No OSM coordinates found for element");
      return [];
    }

    // Get the current element's OSM ID and matches
    const osmId = formatOsmId(currentOsmElement);
    const matches = elementMatches.get(osmId);
    const selectedMatchIndex = selectedMatchIndices.get(osmId) ?? 0;

    // Get the selected Overture match coordinates
    if (!matches || matches.length === 0 || !matches[selectedMatchIndex]) {
      // If no match available, just show OSM coordinate
      return [[osmCoords.lon, osmCoords.lat] as [number, number]];
    }

    const selectedMatch = matches[selectedMatchIndex];

    // Return both: OSM first (green), then Overture (red)
    return [
      [osmCoords.lon, osmCoords.lat] as [number, number],
      [selectedMatch.lon, selectedMatch.lat] as [number, number],
    ];
  }, [overpassElements, currentElement, elementMatches, selectedMatchIndices]);

  return (
    <div className="flex flex-col md:h-screen">
      <ErrorModal
        isOpen={Boolean(error)}
        onClose={() => setError("")}
        message={error}
      />
      <ChangesetModal
        latestChangeset={latestChangeset}
        onClose={() => setLatestChangeset(0)}
      />
      <UploadModal
        show={showFinishedModal && !latestChangeset}
        ways={uploadElements.length}
        onClose={() => setShowFinishedModal(false)}
        uploads={uploadElements}
        setUploadElements={setUploadElements}
        setChangeset={setLatestChangeset}
        setError={setError}
      />
      <AreaCompletedModal
        isOpen={showAreaCompletedModal}
        onClose={() => setShowAreaCompletedModal(false)}
        areaName={relation.name || ""}
      />
      <Navbar
        uploads={uploadElements}
        setShowFinishedModal={setShowFinishedModal}
        setShowHelpModal={() => {}}
        setShowSettingsModal={() => {}}
      />
      <div className="flex flex-col md:flex-row flex-1 bg-background overflow-auto">
        <LeftPane
          showRelationHeading={showRelationHeading}
          overpassElements={overpassElements}
          currentElement={currentElement}
          isLoading={isRelationLoading}
          onNext={handleNext}
        />

        <div className="w-full flex md:flex-1 h-[600px] md:h-auto p-4">
          <Map points={mapCoordinates} zoom={16} />
        </div>
      </div>
    </div>
  );
};

export default App;
