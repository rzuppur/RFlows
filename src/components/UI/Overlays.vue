<template lang="pug">

  .overlays

    portal-target(name="popupMenu" multiple)

    .drop-overlay(:class="{ dropping }")
      .drop-overlay-text
        r-icon.gray(icon="upload")

</template>

<script>
  export default {
    name: "Overlays",
    data() {
      return {
        dropping: false,
      };
    },
    created() {
      this.$events.$on("dropOverlay", this.dropOverlay);
    },
    methods: {
      dropOverlay(visible) {
        this.dropping = !!visible;
      },
    },
  };

</script>

<style lang="stylus" scoped>
  @import "~@/shared.styl"

  .drop-overlay
    position fixed
    left 0
    right 0
    top 0
    bottom 0
    background alpha(#fff, 96%)
    display flex
    align-items center
    flex-direction row
    justify-content space-around
    user-select none
    pointer-events none
    transition all 0.15s
    z-index -1000
    opacity 0

    .darkMode &
      background alpha(#000, 60%)

    &.dropping
      z-index 1000
      opacity 1

    .drop-overlay-text
      font-sans($font-size-large-1)
      color $color-text

      &:before
        content ""
        position absolute
        top 30px
        bottom @top
        left @top
        right @top
        border 2px dashed alpha(#000, .2)
        border-radius $border-radius

</style>
