import React, { useEffect, useState, useCallback, useMemo } from "react";
import Map from "./components/Map";
import Navbar from "./components/Navbar";

import "maplibre-gl/dist/maplibre-gl.css";
import LeftPane from "./components/LeftPane";
import ChangesetModal from "./components/modals/ChangesetModal";
import UploadModal from "./components/modals/UploadModal";
// import HelpModal from "./components/modals/HelpModal";
import AreaCompletedModal from "./components/modals/AreaCompletedModal";
import { overpassService } from "./services/overpass";
import useWayManagement from "./hooks/useWayManagement";
import ErrorModal from "./components/modals/ErrorModal";
import { OsmElement } from "./objects";
import { useChangesetStore } from "./stores/useChangesetStore";
import { useWayTagsStore } from "./stores/useWayTagsStore";
import { useElementStore } from "./stores/useElementStore";
import { useOsmAuthContext } from "./contexts/useOsmAuth";
// import SettingsModal from "./components/modals/SettingsModal";

const App: React.FC = () => {
  const [showRelationHeading, setShowRelationHeading] = useState(false);
  const [latestChangeset, setLatestChangeset] = useState<number>(0);
  const [showFinishedModal, setShowFinishedModal] = useState(false);
  const [isRelationLoading, setIsRelationLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAreaCompletedModal, setShowAreaCompletedModal] = useState(false);
  const { relation, setRelation, setHost, resetDescription } =
    useChangesetStore();
  const { bboxState, updateFromZXY } = useBBoxStore();
  const { params, isBoundingBox, isCenterPoint } = useMemo(
    () => getMapParams(window.location.search),
    [],
  );
  const { currentElementCoordinates } = useWayManagement();
  const {
    overpassElements,
    currentElement,
    uploadElements,
    setOverpassElements,
    setCurrentElement,
    setUploadElements,
    addToUpload,
  } = useElementStore();
  const { loggedIn } = useOsmAuthContext();

  useEffect(() => {
    resetDescription();
  }, [resetDescription]);

  const deduplicateNewElements = useCallback(
    (ways: OsmElement[], shuffle = true) => {
      const unprocessedWays = ways.filter(
        (way) =>
          !uploadElements.some((uploadedWay) => uploadedWay.id === way.id),
      );
      if (shuffle) {
        const shuffledWays = shuffleArray(unprocessedWays);
        setOverpassElements(shuffledWays);
      } else {
        setOverpassElements(unprocessedWays);
      }
    },
    [uploadElements, setOverpassElements], // Add uploadElements as dependency
  );

  useEffect(() => {
    setHost(
      window.location.protocol +
        "//" +
        window.location.host +
        window.location.pathname,
    );
  }, [setHost]);

  useEffect(() => {
    if (params.relation) {
      const fetchWays = async (relationId: string) => {
        // Only fetch if overpassWays is empty
        if (relationId && overpassElements.length === 0) {
          setIsRelationLoading(true);
          setShowRelationHeading(true);
          try {
            const ways = await overpassService.fetchIdsInRelation(relationId);
            if (ways.length === 0) {
              setShowAreaCompletedModal(true);
            } else {
              setOverpassElements([]);
              setCurrentElement(0);

              deduplicateNewElements(ways);
            }
          } catch (error) {
            setError("Error fetching OSM data: " + error);
          } finally {
            setIsRelationLoading(false);
          }
        }
      };

      setRelation({ id: params.relation });
      fetchWays(relation.id);
    }
  }, [
    params,
    bboxState,
    overpassElements.length,
    deduplicateNewWays,
    relation.id,
    setCurrentElement,
    setOverpassElements,
    setRelation,
    isBoundingBox,
    isCenterPoint,
    updateFromZXY,
  ]);

  const handleEnd = useCallback(() => {
    if (currentElement < overpassElements.length - 1) {
      resetTags();
      setCurrentElement(currentElement + 1);
    } else {
      setShowFinishedModal(true);
    }
  }, [
    currentElement,
    overpassElements.length,
    setCurrentElement,
    setShowFinishedModal,
    resetTags,
  ]);

  return (
    <div className="flex flex-col md:h-screen">
      {/*<SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />*/}
      {/*<HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />*/}
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
        ways={currentElement}
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
        setShowHelpModal={setShowHelpModal}
        setShowSettingsModal={setShowSettingsModal}
      />
      <div className="flex flex-col md:flex-row flex-1 bg-background overflow-auto">
        <LeftPane
          showRelationHeading={showRelationHeading}
          overpassElements={overpassElements}
          setOverpassElements={setOverpassElements}
          currentElement={currentElement}
          isLoading={isRelationLoading}
        />

        <div className="w-full flex md:flex-1 h-[600px] md:h-auto p-4">
          <Map points={currentElementCoordinates} zoom={16} />
        </div>
      </div>
    </div>
  );
};
export default App;
