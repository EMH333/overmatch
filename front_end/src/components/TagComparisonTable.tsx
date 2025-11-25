import React, { useMemo, useState, useEffect } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Card } from "@heroui/card";
import { Radio, RadioGroup } from "@heroui/radio";
import { Checkbox } from "@heroui/checkbox";
import { Tags } from "../objects";
import { MatchInfo } from "../types/matching";

interface TagComparisonTableProps {
  osmTags: Tags;
  matches: MatchInfo[];
  selectedMatchIndex: number;
  onMatchSelectionChange: (matchIndex: number) => void;
  onApplyTags: (tags: Tags, selectedMatchIndex: number) => void;
  onNoMatch: (matchIndex: number) => void;
  onSkip: () => void;
}

type TagDiffType = "same" | "different" | "osm-only" | "overture-only";

interface TagComparison {
  key: string;
  osmValue: string | undefined;
  overtureValues: (string | undefined)[];
  diffType: TagDiffType[];
}

// Tags that should be added by default if they don't exist in OSM
const AUTO_ADD_KEYS = ["phone", "website", "cuisine"];
const isAutoAddKey = (key: string): boolean => {
  return AUTO_ADD_KEYS.includes(key) || key.startsWith("addr:");
};

const TagComparisonTable: React.FC<TagComparisonTableProps> = ({
  osmTags,
  matches,
  selectedMatchIndex,
  onMatchSelectionChange,
  onApplyTags,
  onNoMatch,
  onSkip,
}) => {
  // Track which tags are selected for application
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  // Build tag comparison data
  const tagComparisons = useMemo(() => {
    const allKeys = new Set<string>();

    // Collect all unique keys from OSM and all Overture matches
    Object.keys(osmTags).forEach((key) => allKeys.add(key));
    matches.forEach((match) => {
      Object.keys(match.overture_tags).forEach((key) => allKeys.add(key));
    });

    const comparisons: TagComparison[] = [];

    allKeys.forEach((key) => {
      const osmValue = osmTags[key];
      const overtureValues = matches.map((match) =>
        match.overture_tags[key] !== undefined
          ? String(match.overture_tags[key])
          : undefined,
      );

      const diffTypes: TagDiffType[] = overtureValues.map((overtureValue) => {
        if (osmValue === undefined && overtureValue === undefined)
          return "same";
        if (osmValue === undefined) return "overture-only";
        if (overtureValue === undefined) return "osm-only";
        return osmValue === overtureValue ? "same" : "different";
      });

      // Only show if there's a difference or if it exists in either
      const hasInterest =
        diffTypes.some((dt) => dt !== "same") || osmValue !== undefined;

      if (hasInterest) {
        comparisons.push({
          key,
          osmValue,
          overtureValues,
          diffType: diffTypes,
        });
      }
    });

    // Sort: differences first, then by key name
    comparisons.sort((a, b) => {
      const aDiff = a.diffType.some((dt) => dt === "different");
      const bDiff = b.diffType.some((dt) => dt === "different");
      if (aDiff && !bDiff) return -1;
      if (!aDiff && bDiff) return 1;
      return a.key.localeCompare(b.key);
    });

    return comparisons;
  }, [osmTags, matches]);

  // Initialize selected tags based on smart defaults
  useEffect(() => {
    const defaultSelected = new Set<string>();
    const selectedMatch = matches[selectedMatchIndex];

    if (!selectedMatch) return;

    tagComparisons.forEach((comparison) => {
      const overtureValue = comparison.overtureValues[selectedMatchIndex];
      const osmValue = comparison.osmValue;

      // Only consider tags that exist in Overture
      if (overtureValue !== undefined) {
        // If OSM doesn't have this tag and it's an auto-add key, select it
        if (osmValue === undefined && isAutoAddKey(comparison.key)) {
          defaultSelected.add(comparison.key);
        }
        // If OSM has the tag, don't select it (keep OSM value by default)
      }
    });

    setSelectedTags(defaultSelected);
  }, [tagComparisons, selectedMatchIndex, matches]);

  const handleTagToggle = (key: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const getDiffColor = (
    diffType: TagDiffType,
  ): "default" | "primary" | "secondary" | "success" | "warning" | "danger" => {
    switch (diffType) {
      case "same":
        return "success";
      case "different":
        return "warning";
      case "osm-only":
        return "primary";
      case "overture-only":
        return "secondary";
      default:
        return "default";
    }
  };

  const handleApplySelected = () => {
    const selectedMatch = matches[selectedMatchIndex];
    if (!selectedMatch) return;

    const newTags: Tags = { ...osmTags };

    // Apply only selected Overture tags from selected match
    selectedTags.forEach((key) => {
      const value = selectedMatch.overture_tags[key];
      if (value !== undefined && value !== null) {
        newTags[key] = String(value);
      }
    });

    onApplyTags(newTags, selectedMatchIndex);
  };

  // Safety check for empty matches
  if (!matches || matches.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-gray-600">
          No matches available to compare.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {matches.length > 1 && (
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-2">Multiple Matches Found</h3>
          <p className="text-sm text-gray-600 mb-3">
            This OSM element has {matches.length} potential Overture matches.
            Select one to compare:
          </p>
          <RadioGroup
            value={String(selectedMatchIndex)}
            onValueChange={(value) => onMatchSelectionChange(Number(value))}
          >
            {matches.map((match, index) => (
              <Radio key={index} value={String(index)}>
                <div className="flex flex-col">
                  <span className="font-medium">Match {index + 1}</span>
                  <span className="text-xs text-gray-500">
                    Distance: {match.distance_m.toFixed(1)}m | Similarity:{" "}
                    {(match.similarity * 100).toFixed(0)}%
                  </span>
                  {match.overture_tags.name && (
                    <span className="text-xs text-gray-700">
                      Name: {match.overture_tags.name}
                    </span>
                  )}
                </div>
              </Radio>
            ))}
          </RadioGroup>
        </Card>
      )}

      <>
        <Table aria-label="Tag comparison table" className="mb-4">
          <TableHeader>
            <TableColumn>APPLY</TableColumn>
            <TableColumn>KEY</TableColumn>
            <TableColumn>OSM VALUE</TableColumn>
            {matches.length > 1 ? (
              <>
                {matches.map((_, index) => (
                  <TableColumn key={index}>
                    OVERTURE {index + 1}
                    {index === selectedMatchIndex ? " (Selected)" : ""}
                  </TableColumn>
                ))}
              </>
            ) : (
              <TableColumn>OVERTURE VALUE</TableColumn>
            )}
            <TableColumn>STATUS</TableColumn>
          </TableHeader>
          <TableBody>
            {tagComparisons.length === 0 ? (
              <TableRow>
                <TableCell>-</TableCell>
                <TableCell>No differences found</TableCell>
                <TableCell>-</TableCell>
                {matches.length > 1 ? (
                  <>
                    {matches.map((_, index) => (
                      <TableCell key={index}>-</TableCell>
                    ))}
                  </>
                ) : (
                  <TableCell>-</TableCell>
                )}
                <TableCell>-</TableCell>
              </TableRow>
            ) : (
              tagComparisons.map((comparison) => {
                const overtureValue =
                  comparison.overtureValues[selectedMatchIndex];
                const canApply = overtureValue !== undefined;

                return (
                  <TableRow key={comparison.key}>
                    <TableCell>
                      {canApply ? (
                        <Checkbox
                          isSelected={selectedTags.has(comparison.key)}
                          onValueChange={() => handleTagToggle(comparison.key)}
                          size="sm"
                        />
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {comparison.key}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {comparison.osmValue || (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    {matches.length > 1 ? (
                      <>
                        {comparison.overtureValues.map((value, index) => (
                          <TableCell
                            key={index}
                            className={`font-mono text-sm ${index === selectedMatchIndex ? "font-bold" : ""}`}
                          >
                            {value || <span className="text-gray-400">-</span>}
                          </TableCell>
                        ))}
                      </>
                    ) : (
                      <TableCell className="font-mono text-sm">
                        {comparison.overtureValues[0] || (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      {comparison.diffType[selectedMatchIndex] ? (
                        <Chip
                          size="sm"
                          color={getDiffColor(
                            comparison.diffType[selectedMatchIndex],
                          )}
                          variant="flat"
                        >
                          {comparison.diffType[selectedMatchIndex]}
                        </Chip>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        <div className="flex gap-2 justify-end">
          <Button color="danger" onPress={() => onNoMatch(selectedMatchIndex)}>
            Not a match
          </Button>
          <Button color="default" variant="flat" onPress={onSkip}>
            Skip
          </Button>
          <Button
            color="primary"
            onPress={handleApplySelected}
            isDisabled={selectedTags.size === 0}
          >
            Apply tags <Chip size="sm">{selectedTags.size}</Chip>
            {matches.length > 1 && ` from Match ${selectedMatchIndex + 1}`}
          </Button>
        </div>
      </>

      {matches[selectedMatchIndex] && (
        <Card className="p-4">
          <h4 className="text-sm font-semibold mb-2">Match Details</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="font-medium">Overture ID:</span>
              <br />
              <span className="font-mono text-xs">
                {matches[selectedMatchIndex].overture_id}
              </span>
            </div>
            <div>
              <span className="font-medium">Distance:</span>{" "}
              {matches[selectedMatchIndex].distance_m.toFixed(1)}m
            </div>
            <div>
              <span className="font-medium">Name similarity:</span>{" "}
              {(matches[selectedMatchIndex].similarity * 100).toFixed(1)}%
            </div>
            <div>
              <span className="font-medium">Location:</span>{" "}
              {matches[selectedMatchIndex].lat.toFixed(5)},{" "}
              {matches[selectedMatchIndex].lon.toFixed(5)}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default TagComparisonTable;
