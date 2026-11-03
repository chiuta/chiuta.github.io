import webnode from './html.mjs';
import {videoneat, eurostat, jsonShape, npmPackage, pypiPackage} from './json.mjs';
import {pageMentions, hfModels, sha256Pinned} from './watch.mjs';
export const PARSERS = {'webnode-titles': webnode, 'videoneat-index': videoneat, 'eurostat-population': eurostat, 'json-shape': jsonShape,
  'npm-package': npmPackage, 'pypi-package': pypiPackage, 'page-mentions': pageMentions, 'hf-models': hfModels, 'sha256-pinned': sha256Pinned};
