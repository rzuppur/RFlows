import Vue from 'vue'
import App from './App'
import VTooltip from 'v-tooltip'
import VueStash from 'vue-stash'
import clampy from '@clampy-js/vue-clampy';

import utils from "@/js/utils"
import Flows from "@/js/flows"
import store from "@/js/store"
import {RESIZE_DEBOUNCE_TIME, DEBUG} from "@/js/consts";

import "@/assets/main.css";

Vue.use(VTooltip);
Vue.use(VueStash);
Vue.use(clampy);
Vue.config.productionTip = false;

const eventBus = new Vue();

Vue.mixin({
  created() {
    this.flows = this.$root.flows;
    this.eventBus = eventBus;
    this.utils = utils;
    this.DEBUG = DEBUG;
  },
  filters: {
    capitalize(value) {
      if (!value) return '';
      value = value.toString();
      return value.charAt(0).toUpperCase() + value.slice(1);
    },
  },
  methods: {
    _debug(text, ...extra) {
      if (this.DEBUG) {
        const caller = new Error().stack.split('\n')[2].replace(/(\s.+at [^.]+.| \(.+)/g, "");
        this._logDebug(text, caller);
        if (extra) console.log(...extra);
      }
    },
    _logDebug(text, caller) {
      text = text.toString();
      const time = utils.debugDateTime();
      const error = !text.indexOf("! ");
      if (error) text = text.substring(2);
      const parentVNodeTag = this.$options && this.$options._parentVnode && this.$options._parentVnode.tag && this.$options._parentVnode.tag.split("-");
      const name = parentVNodeTag ? parentVNodeTag[parentVNodeTag.length - 1] : "unknown";
      console.log(time + " %c" + name + ".vue (" + caller + "): %c" + text, "color: #3ba776; font-weight: bold", "color: " + (error ? "#f00" : "inherit"));
    },
  },
});

let alwaysFullHeightTimeout = null;

function alwaysFullHeightSetSize(fixAnchor) {
  const elements = document.getElementsByClassName("alwaysFullHeight");
  if (fixAnchor && elements.length) {
    const height = Math.round(fixAnchor.getBoundingClientRect().height || window.innerHeight) + "px";
    for (let i = 0; i < elements.length; i++) {
      elements[i].setAttribute("style", "height:" + height + "; max-height:" + height);
    }
  }
}

new Vue({
  data: {
    flows: null,
    store: store
  },
  directives: {
    clampy
  },
  created() {
    this.flows = new Flows(this.$store, eventBus);

    const fixAnchor = document.getElementById("fixAnchor");
    this.updateFullHeight = () => {
      alwaysFullHeightSetSize(fixAnchor);
    };
    window.addEventListener("resize", () => {
      clearTimeout(alwaysFullHeightTimeout);
      alwaysFullHeightTimeout = setTimeout(this.updateFullHeight, RESIZE_DEBOUNCE_TIME);
    });
  },
  render: h => h(App),
}).$mount('#app');
