import Briefcase from "./Briefcase";
import ChecklistVerify from "./ChecklistVerify";
import CodeWindow from "./CodeWindow";
import Contract from "./Contract";
import FolderCheck from "./FolderCheck";
import Graduation from "./Graduation";
import GrowthChart from "./GrowthChart";
import HandsGroup from "./HandsGroup";
import Handshake from "./Handshake";
import Interview from "./Interview";
import JobSearch from "./JobSearch";
import Matplotlib from "./Matplotlib";
import Mentor2 from "./Mentor2";
import Monitor from "./Monitor";
import Optimization from "./Optimization";
import PeopleGroup from "./PeopleGroup";
import Rigobot from "./Rigobot";
import RigobotIconTiny from "./RigobotIconTiny";
import Rocket from "./Rocket";
import Security from "./Security";
import Slack from "./Slack";
import StairsWithFlag from "./StairsWithFlag";
import CustomTarget from "./CustomTarget";

const customIcons: Record<string, React.ComponentType<{
  width?: string;
  height?: string;
  color?: string;
  style?: React.CSSProperties;
  className?: string;
}>> = {
  Briefcase,
  ChecklistVerify,
  CodeWindow,
  Contract,
  FolderCheck,
  Graduation,
  GrowthChart,
  HandsGroup,
  Handshake,
  Interview,
  JobSearch,
  Matplotlib,
  Mentor2,
  Monitor,
  Optimization,
  PeopleGroup,
  Rigobot,
  RigobotIconTiny,
  Rocket,
  Security,
  Slack,
  BrandSlack: Slack,
  StairsWithFlag,
  CustomTarget,
};

export function getCustomIcon(name: string) {
  return customIcons[name] || null;
}

export {
  Briefcase,
  ChecklistVerify,
  CodeWindow,
  Contract,
  FolderCheck,
  Graduation,
  GrowthChart,
  HandsGroup,
  Handshake,
  Interview,
  JobSearch,
  Matplotlib,
  Mentor2,
  Monitor,
  Optimization,
  PeopleGroup,
  Rigobot,
  RigobotIconTiny,
  Rocket,
  Security,
  Slack,
  StairsWithFlag,
  CustomTarget,
};
