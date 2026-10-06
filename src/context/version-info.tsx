import { createSignal, onCleanup, onMount, type ParentProps } from "solid-js";
import { createRequiredContext } from "@andycmaj/opentui-app";
import { getUpdateInfo, type UpdateInfo } from "../update-check";
import { APP_VERSION } from "../version";

interface VersionInfoContextValue {
  appVersion: string;
  updateInfo: () => UpdateInfo;
}

const [VersionInfoContext, useVersionInfo] =
  createRequiredContext<VersionInfoContextValue>("VersionInfo");

export { useVersionInfo };

export function VersionInfoProvider(props: ParentProps) {
  const [updateInfo, setUpdateInfo] = createSignal<UpdateInfo>({
    status: "loading",
    currentVersion: APP_VERSION,
  });

  let active = true;

  onMount(() => {
    getUpdateInfo(APP_VERSION).then((info) => {
      if (active) setUpdateInfo(info);
    });
  });

  onCleanup(() => {
    active = false;
  });

  return (
    <VersionInfoContext.Provider
      value={{ appVersion: APP_VERSION, updateInfo }}
    >
      {props.children}
    </VersionInfoContext.Provider>
  );
}
