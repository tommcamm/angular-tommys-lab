import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { groupExperiments, sourceUrl, tagVariant } from '../experiments';
import { GithubIcon } from '../shell/github-icon';

@Component({
  selector: 'tommy-home',
  imports: [RouterLink, GithubIcon],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  protected readonly groups = groupExperiments();
  protected readonly sourceUrl = sourceUrl;
  protected readonly tagVariant = tagVariant;
}
