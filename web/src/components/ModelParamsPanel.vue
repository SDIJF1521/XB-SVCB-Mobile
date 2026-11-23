<script setup lang="ts">
import RangeField from '@/components/RangeField.vue'
import type { ModelParamsState } from '@/types/create'

defineProps<{
  framework: string | null | undefined
  params: ModelParamsState
}>()

const RVC_VERSIONS = ['v1', 'v2', 'v3'] as const
</script>

<template>
  <div class="model-params">
    <template v-if="framework === 'rvc'">
      <RangeField
        v-model="params.indexRate"
        label="Index 检索占比"
        :min="0"
        :max="1"
        :format="(value) => value.toFixed(2)"
        hint="仅模型带 .index 时有效；越高越贴近目标音色，过高可能增加金属感。"
      />
      <RangeField
        v-model="params.rmsMix"
        label="响度包络融合"
        :min="0"
        :max="1"
        :format="(value) => value.toFixed(2)"
        hint="较小值保留原曲起伏，较大值保留转换结果自身响度。"
      />
      <RangeField
        v-model="params.protect"
        label="清辅音保护"
        :min="0"
        :max="0.5"
        :step="0.01"
        :format="(value) => value.toFixed(2)"
        hint="越大越保留原声辅音、齿音与呼吸，可减少破音。"
      />
      <RangeField
        v-model="params.filterRadius"
        label="F0 中值滤波"
        :min="0"
        :max="7"
        :step="1"
        :format="(value) => String(Math.round(value))"
        hint="0 表示不滤波；3 以上可降低呼吸杂音。"
      />
      <div class="mini-field">
        <span>RVC 网络版本</span>
        <div class="chips">
          <button
            v-for="version in RVC_VERSIONS"
            :key="version"
            class="chip"
            :class="{ on: params.rvcVersion === version }"
            type="button"
            @click="params.rvcVersion = version"
          >
            {{ version.toUpperCase() }}
          </button>
        </div>
      </div>
    </template>

    <template v-else-if="framework === 'ddsp-svc'">
      <div class="mini-field">
        <span>Rectified Flow 采样步数</span>
        <input v-model.number="params.ddspSteps" class="input compact-input" type="number" min="1" max="300" step="1" />
      </div>
      <RangeField
        v-model="params.ddspFormant"
        label="共振峰偏移"
        :min="-2"
        :max="2"
        :step="0.1"
        :format="(value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}`"
        hint="负值更厚更暗，正值更薄更亮。"
      />
      <label class="mini-field">
        <span>目标说话人</span>
        <input v-model="params.speaker" class="input compact-input" type="text" placeholder="留空使用说话人 1" />
      </label>
    </template>

    <template v-else-if="framework === 'seed-vc'">
      <RangeField
        v-model="params.diffusionRatio"
        label="扩散强度"
        :min="0"
        :max="1"
        :format="(value) => value.toFixed(2)"
        hint="映射为 10~50 个扩散步数；越高通常质量更好、速度更慢。"
      />
    </template>

    <template v-else>
      <RangeField
        v-model="params.diffusionRatio"
        label="浅扩散强度"
        :min="0"
        :max="1"
        :format="(value) => value.toFixed(2)"
        hint="映射为 1~200 个浅扩散步骤；越高越细致。"
      />
      <label class="mini-field">
        <span>目标说话人</span>
        <input v-model="params.speaker" class="input compact-input" type="text" placeholder="留空使用模型首个说话人" />
      </label>
    </template>

    <div class="manual-row">
      <div>
        <b>全参数手动调整</b>
        <span>开启后可设置高音保护轮次与 F0 过滤阈值</span>
      </div>
      <button class="switch" :class="{ on: params.manual }" type="button" @click="params.manual = !params.manual"></button>
    </div>

    <template v-if="params.manual">
      <RangeField
        v-model="params.guardRounds"
        label="高音保护轮次"
        :min="0"
        :max="8"
        :step="1"
        :format="(value) => String(Math.round(value))"
        hint="0 表示交给系统使用默认保护轮次。"
      />
      <RangeField
        v-model="params.f0Threshold"
        label="F0 过滤阈值"
        :min="0"
        :max="1"
        :format="(value) => value.toFixed(2)"
      />
    </template>
  </div>
</template>

<style scoped>
.model-params {
  display: flex;
  flex-direction: column;
  gap: 11px;
}

.mini-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  color: var(--xb-text);
  font-size: 10.5px;
  font-weight: 700;
}

.compact-input {
  min-height: 36px;
  padding: 6px 9px;
  font-size: 11px;
}

.manual-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 8px;
  border-top: 1px dashed var(--xb-border);
}

.manual-row > div {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.manual-row b {
  font-size: 10.5px;
}

.manual-row span {
  color: var(--xb-muted);
  font-size: 8.5px;
  line-height: 1.45;
}
</style>
