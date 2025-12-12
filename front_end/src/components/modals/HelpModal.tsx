import React from "react";
import { Button } from "@heroui/button";
import { Code } from "@heroui/code";
import { Link } from "@heroui/link";
import BaseModal from "./BaseModal";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const workflowSteps = [
  {
    title: "Select an Area",
    description:
      "Choose a geographic area by searching for a city, county, or neighborhood relation in the search bar.",
  },
  {
    title: "Review Matches",
    description:
      "View OSM amenities (restaurants, cafes, bars, etc.) matched with corresponding Overture Maps data.",
  },
  {
    title: "Compare Tags",
    description:
      "Examine the tag comparison table showing differences between OSM and Overture data. Tags are color-coded for easy identification.",
  },
  {
    title: "Apply or Skip",
    description:
      "Apply enriched tags from Overture to OSM elements, or skip matches that don't seem correct.",
  },
  {
    title: "Upload Changes",
    description:
      "Review your changes and upload them as a changeset to OpenStreetMap.",
  },
];

const tagColorGuide = [
  {
    color: "bg-green-100 dark:bg-green-900",
    label: "Identical values",
    description: "Both OSM and Overture have the same value",
  },
  {
    color: "bg-yellow-100 dark:bg-yellow-900",
    label: "Different values",
    description: "Tag exists in both but with different values",
  },
  {
    color: "bg-blue-100 dark:bg-blue-900",
    label: "OSM only",
    description: "Tag exists only in OSM data",
  },
  {
    color: "bg-purple-100 dark:bg-purple-900",
    label: "Overture only",
    description: "Tag exists only in Overture data (potential enrichment)",
  },
];

const actionButtons = [
  {
    name: "Apply tags",
    color: "primary" as const,
    description:
      "Apply the selected Overture tags to the OSM element. The element will be added to your upload queue for review.",
  },
  {
    name: "Nothing to add",
    color: "secondary" as const,
    description:
      "Use this when the match is correct but Overture doesn't provide any useful new information. This also marks the Overture element as processed.",
  },
  {
    name: "Not a match",
    color: "danger" as const,
    variant: "light" as const,
    description:
      "Use this when the Overture data is matched to the wrong OSM element. This marks the Overture element as not matching and it won't appear again.",
  },

  {
    name: "Skip",
    color: "default" as const,
    variant: "flat" as const,
    description:
      "Use this to temporarily skip this match and come back to it later. The match will appear again on your next session.",
  },
];

const externalLinks = [
  {
    label: "About Overture Maps",
    href: "https://overturemaps.org/",
  },
  {
    label: "Overmatch on GitHub",
    href: "https://github.com/whubsch/overmatch",
  },
  {
    label: "OpenStreetMap Wiki",
    href: "https://wiki.openstreetmap.org/",
  },
];

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  return (
    <BaseModal
      modalType="narrow"
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={{
        label: "Overmatch Guide",
        emoji: "📖",
        colorClass: "text-blue-600 dark:text-blue-400",
      }}
      subtitle="Learn how to enrich OSM with Overture Maps data"
      actions={[
        {
          label: "Got it!",
          color: "primary",
          variant: "flat",
          onClick: onClose,
        },
      ]}
    >
      <div className="space-y-6">
        <section>
          <h3 className="text-lg font-semibold mb-3">How It Works</h3>
          <ol className="space-y-3">
            {workflowSteps.map((step, index) => (
              <li key={index} className="flex gap-3">
                <span className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  {index + 1}
                </span>
                <div>
                  <strong>{step.title}:</strong> {step.description}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-3">Action Buttons</h3>
          <div className="space-y-3">
            {actionButtons.map((action, index) => (
              <div key={index} className="flex items-start gap-3">
                <Button
                  size="sm"
                  variant={action.variant ? action.variant : "solid"}
                  color={action.color}
                  className="flex items-center justify-center min-w-32 shrink-0"
                >
                  {action.name}
                </Button>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {action.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-3">
            Understanding Tag Colors
          </h3>
          <div className="space-y-2">
            {tagColorGuide.map((item, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded ${item.color} shrink-0`} />
                <div>
                  <div className="font-medium">{item.label}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {item.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-lg font-semibold mb-3">What is Overture Maps?</h3>
          <div className="gap-2">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Overture Maps is an open map data initiative that combines data
              from multiple sources. This tool helps you compare Overture's data
              with OpenStreetMap and selectively enrich OSM with additional tags
              like <Code size="sm">phone</Code>, <Code size="sm">website</Code>,{" "}
              <Code size="sm">addr:*</Code>, and more.
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              All the data you'll see here has been preprocessed from what
              Overture provides out of the box. Overture Map data available here
              is released under the{" "}
              <Link
                isExternal
                showAnchorIcon
                className="text-sm"
                href="https://cdla.dev/permissive-2-0/"
              >
                CDLA Permissive 2.0
              </Link>{" "}
              and{" "}
              <Link
                isExternal
                showAnchorIcon
                className="text-sm"
                href="https://creativecommons.org/publicdomain/zero/1.0/deed.en"
              >
                CC0
              </Link>{" "}
              licenses.{" "}
            </p>
          </div>
        </section>

        <div className="flex justify-center pt-4 gap-2 flex-wrap">
          {externalLinks.map((link, index) => (
            <Button
              key={index}
              size="sm"
              showAnchorIcon
              as={Link}
              href={link.href}
              target="_blank"
              variant="flat"
            >
              {link.label}
            </Button>
          ))}
        </div>
      </div>
    </BaseModal>
  );
};

export default HelpModal;
