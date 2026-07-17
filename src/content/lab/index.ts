import type { Exercise, ExerciseMeta } from './types'

import zcoInventoryCostsMeta from './zco-inventory-costs/exercise.json'
import zcoInventoryCostsMain from './zco-inventory-costs/files/zco_inventory_costs_anhbhn.abap?raw'
import zcoInventoryCostsTop from './zco-inventory-costs/files/zco_inventory_costs_anhbhn_top.abap?raw'
import zcoInventoryCostsSel from './zco-inventory-costs/files/zco_inventory_costs_anhbhn_sel.abap?raw'
import zcoInventoryCostsF01 from './zco-inventory-costs/files/zco_inventory_costs_anhbhn_f01.abap?raw'
import zxlsxCommon from './zco-inventory-costs/files/zxlsx_common.abap?raw'

import zday10Exe01Meta from './zday10-exe-01/exercise.json'
import zday10Exe01Src from './zday10-exe-01/files/zday10_exe_01_anhbhn.abap?raw'

import zday10Exe02Meta from './zday10-exe-02/exercise.json'
import zday10Exe02Src from './zday10-exe-02/files/zday10_exe_02_anhbhn.abap?raw'

import zday11BdcMeta from './zday11-bdc-fs00-mass/exercise.json'
import zday11BdcSrc from './zday11-bdc-fs00-mass/files/zday11_bdc_fs00_mass_anhbhn.abap?raw'

import zday2Exe01Meta from './zday2-exe-01/exercise.json'
import zday2Exe01Src from './zday2-exe-01/files/zday2_exe_01_anhbhn.abap?raw'

import zday2Exe02Meta from './zday2-exe-02/exercise.json'
import zday2Exe02Src from './zday2-exe-02/files/zday2_exe_02_anhbhn.abap?raw'

import zday5Exe01Meta from './zday5-exe-01/exercise.json'
import zday5Exe01Src from './zday5-exe-01/files/zday5_exe_01_anhbhn.abap?raw'

import zday5Exe02Meta from './zday5-exe-02/exercise.json'
import zday5Exe02Src from './zday5-exe-02/files/zday5_exe_02_anhbhn.abap?raw'

import zday5Exe03Meta from './zday5-exe-03/exercise.json'
import zday5Exe03Src from './zday5-exe-03/files/zday5_exe_03_anhbhn.abap?raw'

import zday6Exe01Meta from './zday6-exe-01/exercise.json'
import zday6Exe01Src from './zday6-exe-01/files/zday6_exe_01_anhbhn.abap?raw'

import zday8Exe01Meta from './zday8-exe-01/exercise.json'
import zday8Exe01Src from './zday8-exe-01/files/zday8_exe_01_anhbhn.abap?raw'

import zday8Exe02Meta from './zday8-exe-02/exercise.json'
import zday8Exe02Src from './zday8-exe-02/files/zday8_exe_02_anhbhn.abap?raw'

import zday8Exe03Meta from './zday8-exe-03/exercise.json'
import zday8Exe03Src from './zday8-exe-03/files/zday8_exe_03_anhbhn.abap?raw'

import zday9Exe011Meta from './zday9-exe-01-1/exercise.json'
import zday9Exe011Src from './zday9-exe-01-1/files/zday9_exe_01_1_anhbhn.abap?raw'

import zday9Exe012Meta from './zday9-exe-01-2/exercise.json'
import zday9Exe012Src from './zday9-exe-01-2/files/zday9_exe_01_2_anhbhn.abap?raw'

import zday9Exe03Meta from './zday9-exe-03/exercise.json'
import zday9Exe03Src from './zday9-exe-03/files/zday9_exe_03_anhbhn.abap?raw'

import ztestCodeMeta from './ztest-code/exercise.json'
import ztestCodeSrc from './ztest-code/files/ztest_code.abap?raw'

function build(meta: ExerciseMeta, files: [string, string][]): Exercise {
  return {
    ...meta,
    files: files.map(([filename, code]) => ({ filename, code })),
  }
}

export const EXERCISES: Exercise[] = [
  build(zcoInventoryCostsMeta as ExerciseMeta, [
    ['zco_inventory_costs_anhbhn.abap', zcoInventoryCostsMain],
    ['zco_inventory_costs_anhbhn_top.abap', zcoInventoryCostsTop],
    ['zco_inventory_costs_anhbhn_sel.abap', zcoInventoryCostsSel],
    ['zco_inventory_costs_anhbhn_f01.abap', zcoInventoryCostsF01],
    ['zxlsx_common.abap', zxlsxCommon],
  ]),
  build(zday10Exe01Meta as ExerciseMeta, [['zday10_exe_01_anhbhn.abap', zday10Exe01Src]]),
  build(zday10Exe02Meta as ExerciseMeta, [['zday10_exe_02_anhbhn.abap', zday10Exe02Src]]),
  build(zday11BdcMeta as ExerciseMeta, [['zday11_bdc_fs00_mass_anhbhn.abap', zday11BdcSrc]]),
  build(zday2Exe01Meta as ExerciseMeta, [['zday2_exe_01_anhbhn.abap', zday2Exe01Src]]),
  build(zday2Exe02Meta as ExerciseMeta, [['zday2_exe_02_anhbhn.abap', zday2Exe02Src]]),
  build(zday5Exe01Meta as ExerciseMeta, [['zday5_exe_01_anhbhn.abap', zday5Exe01Src]]),
  build(zday5Exe02Meta as ExerciseMeta, [['zday5_exe_02_anhbhn.abap', zday5Exe02Src]]),
  build(zday5Exe03Meta as ExerciseMeta, [['zday5_exe_03_anhbhn.abap', zday5Exe03Src]]),
  build(zday6Exe01Meta as ExerciseMeta, [['zday6_exe_01_anhbhn.abap', zday6Exe01Src]]),
  build(zday8Exe01Meta as ExerciseMeta, [['zday8_exe_01_anhbhn.abap', zday8Exe01Src]]),
  build(zday8Exe02Meta as ExerciseMeta, [['zday8_exe_02_anhbhn.abap', zday8Exe02Src]]),
  build(zday8Exe03Meta as ExerciseMeta, [['zday8_exe_03_anhbhn.abap', zday8Exe03Src]]),
  build(zday9Exe011Meta as ExerciseMeta, [['zday9_exe_01_1_anhbhn.abap', zday9Exe011Src]]),
  build(zday9Exe012Meta as ExerciseMeta, [['zday9_exe_01_2_anhbhn.abap', zday9Exe012Src]]),
  build(zday9Exe03Meta as ExerciseMeta, [['zday9_exe_03_anhbhn.abap', zday9Exe03Src]]),
  build(ztestCodeMeta as ExerciseMeta, [['ztest_code.abap', ztestCodeSrc]]),
]

export function findExercise(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id)
}
