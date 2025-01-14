import React, { FC, createContext, useEffect, useState } from "react";

import { getCameras, subscribeCameras, subscribeRecording } from "lib/commands";
import { sortObj } from "lib/helpers";
import * as types from "lib/types";
import { Connection } from "lib/websockets";

export type ViseronProviderProps = {
  children: React.ReactNode;
};

export type ViseronContextState = {
  connection: Connection | undefined;
  connected: boolean;
  cameras: types.Cameras;
};

const contextDefaultValues: ViseronContextState = {
  connection: undefined,
  connected: false,
  cameras: {},
};

export const ViseronContext =
  createContext<ViseronContextState>(contextDefaultValues);

export const ViseronProvider: FC<ViseronProviderProps> = ({
  children,
}: ViseronProviderProps) => {
  const [connection, setConnection] = useState<Connection | undefined>(
    undefined
  );
  const [connected, setConnected] = useState<boolean>(false);
  const [cameras, setCameras] = useState<types.Cameras>({});

  useEffect(() => {
    if (connection) {
      const cameraRegistered = async (camera: types.Camera) => {
        setCameras((prevCameras) => {
          let newCameras = { ...prevCameras };
          newCameras[camera.identifier] = camera;
          newCameras = sortObj(newCameras);
          return newCameras;
        });
      };
      const newRecording = async (
        recordingEvent: types.EventRecorderComplete
      ) => {
        setCameras((prevCameras) => {
          const newCameras = { ...prevCameras };
          const recording = recordingEvent.data.recording;
          const camera = recordingEvent.data.camera;
          const prevRecordings = newCameras[camera.identifier].recordings;

          if (recording.date in prevRecordings) {
            prevRecordings[recording.date][recording.filename] = recording;
          } else {
            prevRecordings[recording.date] = {
              [recording.filename]: recording,
            };
          }
          newCameras[camera.identifier].recordings = prevRecordings;
          return newCameras;
        });
      };

      const onConnect = async () => {
        setConnected(true);
        const registeredCameras = await getCameras(connection);
        setCameras(sortObj(registeredCameras));
      };
      connection!.addEventListener("connected", onConnect);

      const onDisonnect = async () => {
        setConnected(false);
      };
      connection!.addEventListener("disconnected", onDisonnect);

      const connect = async () => {
        subscribeCameras(connection, cameraRegistered); // call without await to not block
        subscribeRecording(connection, newRecording); // call without await to not block
        await connection!.connect();
      };
      connect();
    }
  }, [connection]);

  useEffect(() => {
    setConnection(new Connection());
  }, []);

  return (
    <ViseronContext.Provider value={{ connection, connected, cameras }}>
      {children}
    </ViseronContext.Provider>
  );
};
