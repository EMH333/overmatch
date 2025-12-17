import React from "react";
import BaseModal from "./BaseModal";
import { Alert } from "@heroui/alert";

interface AreaCompletedModalProps {
  isOpen: boolean;
  onClose: () => void;
  areaName: string;
}

const AreaCompletedModal: React.FC<AreaCompletedModalProps> = ({
  isOpen,
  onClose,
  areaName,
}) => {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={{
        label: "Area Completed!",
        emoji: "🌟",
        colorClass: "text-green-600",
      }}
      subtitle={`Congratulations on completing the ${areaName} area!`}
      actions={[
        {
          label: "View Match Map",
          color: "success",
          variant: "flat",
          onClick: () => {
            window.open(
              "https://overpass-ultra.us/#map&query=url:https://raw.githubusercontent.com/whubsch/overmatch/master/overpass-ultra.ultra",
              "_blank",
            );
          },
        },
        {
          label: "Close",
          color: "default",
          variant: "flat",
          onClick: onClose,
        },
      ]}
    >
      <div className="space-y-4 mb-2">
        <Alert
          color="success"
          variant="faded"
          title={"Great work!"}
          description={
            "Your contributions are helping improve the map for everyone. This area has no outstanding matches!"
          }
        />

        <div className="text-sm text-gray-600 space-y-2">
          <p>
            Ready to tackle another area? Try working on a different region to
            improve the map everywhere!
          </p>
        </div>
      </div>
    </BaseModal>
  );
};

export default AreaCompletedModal;
