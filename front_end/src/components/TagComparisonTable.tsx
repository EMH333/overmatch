import React, { useState, useMemo } from "react";
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
import { Tags } from "../objects";
import { MatchInfo } from "../types/matching";

interface TagComparisonTableProps {
  osmTags: Tags;
  matches: MatchInfo[];
  onApplyTags: (tags: Tags, selectedMatchIndex: number) => void;
  onSkipMatch: (matchIndex: number) => void;
}

type TagDiffType = "same" | "different" | "osm-only" | "overture-only";

interface TagComparison {
  key: string;
  osmValue: string | undefined;
  overtureValues: (string | undefined)[];
  diffType: TagDiffType[];
}

const TagComparisonTable: React.FC<TagComparisonTableProps> = ({
  osmTags,
  matches,
  onApplyTags,
  onSkipMatch,
}) => {
  const [selectedMatchIndex, setSelectedMatchIndex] = useState(0);

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
    const newTags: Tags = { ...osmTags };

    // Apply all Overture tags from selected match
    Object.entries(selectedMatch.overture_tags).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        newTags[key] = String(value);
      }
    });

    onApplyTags(newTags, selectedMatchIndex);
  };

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
            onValueChange={(value) => setSelectedMatchIndex(Number(value))}
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

      <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Tag Comparison</h3>
          <div className="flex gap-2">
            <Chip size="sm" color="success">
              Same
            </Chip>
            <Chip size="sm" color="warning">
              Different
            </Chip>
            <Chip size="sm" color="primary">
              OSM Only
            </Chip>
            <Chip size="sm" color="secondary">
              Overture Only
            </Chip>
          </div>
        </div>

        <Table aria-label="Tag comparison table" className="mb-4">
          <TableHeader>
            <TableColumn>KEY</TableColumn>
            <TableColumn>OSM VALUE</TableColumn>
            {matches.length > 1 &&
              matches.map((_, index) => (
                <TableColumn key={index}>
                  OVERTURE {index + 1}
                  {index === selectedMatchIndex && " (Selected)"}
                </TableColumn>
              ))}
            {matches.length === 1 && <TableColumn>OVERTURE VALUE</TableColumn>}
            <TableColumn>STATUS</TableColumn>
          </TableHeader>
          <TableBody>
            {tagComparisons.length === 0 ? (
              <TableRow>
                <TableCell>-</TableCell>
                <TableCell>No differences found</TableCell>
                <TableCell>-</TableCell>
                <TableCell>-</TableCell>
              </TableRow>
            ) : (
              tagComparisons.map((comparison) => (
                <TableRow key={comparison.key}>
                  <TableCell className="font-mono text-sm">
                    {comparison.key}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {comparison.osmValue || (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  {matches.length > 1 &&
                    comparison.overtureValues.map((value, index) => (
                      <TableCell
                        key={index}
                        className={`font-mono text-sm ${index === selectedMatchIndex ? "font-bold" : ""}`}
                      >
                        {value || <span className="text-gray-400">-</span>}
                      </TableCell>
                    ))}
                  {matches.length === 1 && (
                    <TableCell className="font-mono text-sm">
                      {comparison.overtureValues[0] || (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <Chip
                      size="sm"
                      color={getDiffColor(
                        comparison.diffType[selectedMatchIndex],
                      )}
                      variant="flat"
                    >
                      {comparison.diffType[selectedMatchIndex]}
                    </Chip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="flex gap-2 justify-end">
          <Button
            color="danger"
            variant="flat"
            onPress={() => onSkipMatch(selectedMatchIndex)}
          >
            Skip This Match
          </Button>
          <Button color="primary" onPress={handleApplySelected}>
            Apply Overture Tags{" "}
            {matches.length > 1 && `(Match ${selectedMatchIndex + 1})`}
          </Button>
        </div>
      </Card>

      {matches[selectedMatchIndex] && (
        <Card className="p-4 bg-gray-50">
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
              <span className="font-medium">Similarity:</span>{" "}
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
