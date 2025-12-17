import React, { useState, useEffect } from "react";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Button } from "@heroui/button";
import ConfirmationModal from "./modals/ConfirmationModal";
import search from "../assets/search.svg";
import relation from "../assets/relation.svg";
import Icon from "./Icon";

const OSM_VALUES_WITH_AREA_SUFFIX = [
  "statistical",
  "planning",
  "administrative",
];

interface LocationFeature {
  properties: {
    name: string;
    osm_type: string;
    osm_id: string;
    osm_key: string;
    osm_value: string;
    country: string;
    countrycode?: string;
    state?: string;
    county?: string;
    type?: string;
  };
}

interface LocationAutocompleteProps {
  compact?: boolean;
  className?: string;
}

export const LocationAutocomplete: React.FC<LocationAutocompleteProps> = ({
  compact = false,
  className = "",
}) => {
  const [inputValue, setInputValue] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedValue, setSelectedValue] = useState<
    LocationFeature | string | null
  >(null);
  const [suggestions, setSuggestions] = useState<LocationFeature[]>([]);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Derived state: check if current input is a valid integer
  const isDirectOsmId = /^\d+$/.test(inputValue.trim());

  useEffect(() => {
    // If input is an integer, don't fetch suggestions
    if (isDirectOsmId) {
      setSuggestions([]);
      return;
    }

    // Only fetch if input is long enough
    if (inputValue.length < 2) {
      setSuggestions([]);
      return;
    }

    // Create a function to fetch suggestions
    const fetchSuggestions = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(inputValue)}&osm_tag=place&osm_tag=boundary&bbox=-171.791,18.916,-66.964,71.357`,
        );
        const data = await response.json();

        const filteredSuggestions = data.features.filter(
          (feature: LocationFeature) =>
            feature.properties.osm_type === "R" &&
            feature.properties.countrycode === "US",
        );

        // Deduplicate by osm_type and osm_id
        const seen = new Set<string>();
        const deduplicatedSuggestions = filteredSuggestions.filter(
          (feature: LocationFeature) => {
            const key = `${feature.properties.osm_type}-${feature.properties.osm_id}`;
            if (seen.has(key)) {
              return false;
            }
            seen.add(key);
            return true;
          },
        );

        setSuggestions(deduplicatedSuggestions);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]);
        setIsLoading(false);
      }
    };

    // Add debounce
    const timeoutId = setTimeout(fetchSuggestions, 300);

    return () => clearTimeout(timeoutId);
  }, [inputValue, isDirectOsmId]);

  const generateLocationDescription = (feature: LocationFeature): string => {
    const { state, county, osm_value } = feature.properties;
    const osmLabel = OSM_VALUES_WITH_AREA_SUFFIX.includes(osm_value)
      ? `${osm_value.replaceAll("_", " ")} area`
      : osm_value.replaceAll("_", " ");
    if (state && county) {
      return `${osmLabel} in ${county}, ${state}`;
    } else if (state) {
      return `${osmLabel} in ${state}`;
    } else {
      return `${osmLabel}`;
    }
  };

  const handleSubmit = () => {
    if (!selectedValue) return;

    // If selectedValue is a string, it's a direct OSM ID
    if (typeof selectedValue === "string") {
      window.location.href = `/overmatch/?relation=${selectedValue}`;
    } else {
      // Otherwise it's a LocationFeature
      window.location.href = `/overmatch/?relation=${selectedValue.properties.osm_id}`;
    }
  };

  // Handle input change
  const handleInputChange = (value: string) => {
    setInputValue(value);
  };

  // Determine if submit button should be enabled
  const isSubmitEnabled = Boolean(selectedValue);

  return (
    <div
      className={`
        flex
        ${compact ? "flex-row items-center gap-2" : "flex-col gap-2"}
        ${className}
      `}
    >
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleSubmit}
        confirmText="Change"
      >
        <p>
          This will reset your progress, although your edits will remain
          available. Are you sure you want to change the area?
        </p>
      </ConfirmationModal>
      <Autocomplete
        label={!compact ? "Location" : undefined}
        aria-label={compact ? "Location Search" : undefined}
        className={compact ? "w-2xs" : ""}
        placeholder="Enter a location or OSM relation ID"
        listboxProps={{
          emptyContent: "No OSM relations found.",
        }}
        isLoading={isLoading}
        inputValue={inputValue}
        selectedKey={selectedKey}
        onInputChange={handleInputChange}
        onSelectionChange={(key) => {
          setSelectedKey(key as string);
          if (key === "direct-osm-id") {
            // User clicked the direct OSM ID suggestion
            setSelectedValue(inputValue.trim());
          } else if (key) {
            const index = Number(key);
            if (!isNaN(index) && index >= 0 && index < suggestions.length) {
              setSelectedValue(suggestions[index]);
            }
          }
        }}
        startContent={
          isDirectOsmId &&
          inputValue.length > 0 && (
            <Icon src={relation} alt="relation" size="w-4 h-4" invert={false} />
          )
        }
        endContent={
          compact ? (
            <Button
              size="sm"
              isIconOnly
              color="primary"
              onPress={() => setIsConfirmModalOpen(true)}
              isDisabled={!isSubmitEnabled}
              className="rounded-full m-1"
              aria-label="Load"
            >
              <Icon
                src={search}
                alt="search"
                size="w-4 h-4"
                invert={false}
                className="stroke-white"
              />
            </Button>
          ) : null
        }
      >
        {isDirectOsmId && inputValue.length > 0 ? (
          <AutocompleteItem
            key="direct-osm-id"
            title={inputValue.trim()}
            description="Click to use this relation ID directly"
          />
        ) : (
          suggestions.map((feature, index) => (
            <AutocompleteItem
              key={index}
              title={feature.properties.name}
              description={generateLocationDescription(feature)}
            >
              {feature.properties.name}
            </AutocompleteItem>
          ))
        )}
      </Autocomplete>
      <Button
        color="primary"
        onPress={handleSubmit}
        isDisabled={!isSubmitEnabled}
        className={`${compact ? "hidden" : "w-full"}`}
        aria-label="Load"
      >
        <Icon
          src={search}
          alt="search"
          size="w-4 h-4"
          invert={false}
          className="stroke-white"
        />
        Load
      </Button>
    </div>
  );
};

export default LocationAutocomplete;
