<script lang="ts">
	type PanelTab = {
		value: string;
		label: string;
		testId?: string;
		id?: string;
		controls?: string;
	};

	interface Props {
		activeTab: string;
		tabs: PanelTab[];
		ariaLabel: string;
	}

	let { activeTab = $bindable(''), tabs, ariaLabel }: Props = $props();
</script>

<div class="panel-tabs panel-shell__tablist" role="tablist" aria-label={ariaLabel}>
	{#each tabs as tab}
		<button
			class="panel-shell__tab"
			class:panel-shell__tab--active={activeTab === tab.value}
			type="button"
			role="tab"
			id={tab.id}
			aria-selected={activeTab === tab.value}
			aria-controls={tab.controls}
			data-testid={tab.testId}
			onclick={() => (activeTab = tab.value)}
		>
			{tab.label}
		</button>
	{/each}
</div>

<style>
	.panel-tabs {
		align-self: flex-start;
		width: fit-content;
		max-width: max-content;
	}
</style>
